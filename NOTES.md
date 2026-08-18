# T004 findings: what published Markless 0.2.2 actually does

Everything below was hit while scaffolding this repo from `npm create markless@0.2.2` and building
it against published `@markless/*@0.2.2` with npm. Each item is a reproduction, not a guess.

## 1. A clean `npm install` of a 0.2.2 app fails (registry, not Markless)

`@markless/router@0.2.2` depends on `@tsrx/core@^0.1.32`. The newest match, `@tsrx/core@0.1.60`,
depends on `@tsrx/runtime@0.1.1`, which is not on the registry:

```
npm error 404 Not Found - GET https://registry.npmjs.org/@tsrx%2fruntime - Not found
npm error 404  The requested resource '@tsrx/runtime@0.1.1' could not be found
```

`@tsrx/core@0.1.59` and `0.1.60` carry that dependency; `0.1.58` and older do not. This repo pins
around it with an npm override in `package.json`:

```json
"overrides": { "@tsrx/core": "0.1.58" }
```

Anyone following the published "new Markless app" instructions today hits this, so it needs an
upstream fix (republish `@tsrx/runtime`, or a Markless release that pins `@tsrx/core`) before the
docs can tell a reader to run `npm install`.

## 2. `<Html>` from `@markless/router` breaks the SSR build

Any app-level import of `@markless/router` (or `@markless/core/router`) fails the ssr environment:

```
[UNLOADABLE_DEPENDENCY] Error: Could not load @markless/router - No such file or directory (os error 2).
```

Reproduced on a pristine `--starter app` scaffold with its own `document.tsrx`, both inside and
outside the markless repo, with and without the base-path options, so it is not this repo's layout.
Aliasing `@markless/router` to its resolved `dist/index.js` gets past resolution and into a second
wall:

```
MARKLESS_CAPTURE_METADATA_MISSING: Parent module ".../document.tsrx" composes imported child
"@markless/router", but its compiled artifact has no current capture metadata.
```

**Workaround used here:** `document.tsrx` renders a plain `<html>` root instead of `<Html>`. The
server shell already emits `<!doctype html><html lang="en">`, so the served markup contains a
nested `<html>` tag that the HTML parser folds away. Everything `Html` is presumed to provide is
still emitted: the stylesheet link, the `modulepreload` tags, the route script and the resume
script all appear in the served HTML, and the island resumes (see the witness).

A fragment root is not an option: `MARKLESS_PUBLIC_RENDER_ROOT_UNSUPPORTED` rejects a fragment whose
top-level children are not all plain host elements.

## 3. `@for` renders nothing in the document shell

`@for (const entry of entries; key entry.href) { <li>…</li> }` inside `document.tsrx` emits an
empty `<ul>`. Tried three ways, all empty:

- looping over `nav` imported from `nav.ts`
- looping over an array literal declared in `document.tsrx` itself
- moving the loop into `components/docs/Sidebar.tsrx` and composing `<Sidebar />` from the document

Static markup in the same positions renders fine, and component composition works, so the failure is
specific to `@for` on the document path. `components/docs/Sidebar.tsrx` therefore writes its links
out by hand. `nav.ts` is kept as the intended single source and should drive the sidebar again as
soon as a loop works there (or once the sidebar is proven to loop correctly inside a page).

## 4. Component props cannot have destructuring defaults

```
MARKLESS_STATE_DESTRUCTURE_DEFAULT_UNSUPPORTED: Cannot create graph alias "start" from
"props.start" with a default value.
```

So `function Counter({ start = 0 })` is a compile error. Declare the prop without a default and pass
it explicitly, or use `computed()` for the fallback.

## 5. MDX rejects raw HTML

A literal `<details>` block inside an `.mdx` page fails with
`Markless Router MDX component is not imported from .tsrx: details`. Any angle-bracket block in MDX
must be an imported `.tsrx` component, so the collapsible is `components/demos/Collapsible.tsrx`.
Markdown itself (headings, paragraphs, fenced code, inline code, links) renders normally.

## 6. Base path under `/markless/` works (the packet's risk (a))

`pages/markless/…` plus `base: '/markless/'` and `nitro: { baseURL: '/markless/' }` in
`vite.config.ts` serves correctly. Against the production build:

- `GET /markless` -> 200
- `GET /markless/concepts/state` -> 200
- `GET /markless/assets/global-*.css` -> 200, `text/css`
- `GET /` -> 404 (expected: nothing is mounted at the root)

Emitted asset URLs are `/markless/assets/…` and `/markless/build/…`. No prefix stripping or proxy
rewriting was needed. `<Link>` from `@markless/router` was not used, because importing that package
from app code breaks the build (finding 2); the chrome uses plain `<a href>`.

## 7. MDX island resume works (the packet's risk (b))

`scripts/witness.mjs` serves the production build, opens `/markless/concepts/state` in system
Chrome, and clicks the counter. The count moves 0 -> 1 -> 2 and the screenshots in
`goals/compiled-website/notes/shots/` show it.

One caveat: two clicks fired back to back lose the second one. The first click is what wakes the
island, and a click that lands mid-resume is dropped. The witness therefore waits for the text to
settle between clicks. A reader hammering a demo button will see the same drop.

## 8. What the MDX emit looks like at 0.2.2, and what that costs a highlighter

Syntax highlighting had to be added without touching the `.mdx` sources, because of finding 5: the
router's MDX plugin rejects raw HTML, so highlighted markup cannot be written into a page. The only
place it can go is the module the router emits. Everything below was read out of
`node_modules/@markless/router/dist/vite.js` and confirmed against the built output.

### The shape

`markless-router:mdx` runs at `enforce: 'pre'` and emits, for a page that composes components:

```js
const marklessMdxParts = [{"kind":"html","html":"…","elementCount":12},{"kind":"component","componentIndex":0}, …];
```

plus the same HTML again as string literals inside `renderSsr` and `renderCsr`. A page with no
components emits no parts at all, only `return { html: "…" };`.

`elementCount` is the number of elements in that chunk of HTML, descendants included.
`composeMdxView` adds those counts up to work out the DOM-order index of every island element on the
page, so **any rewrite of a part's HTML has to recount its elements or every island moves**. There
is no `elementTags` array at 0.2.2, only the count.

`tooling/highlight-mdx.ts` therefore recounts, and before it changes anything it checks its own
counter against the count the router wrote. If the two ever disagree the build fails instead of
shipping islands that resume against the wrong nodes. The witness proves the arithmetic end to end:
the Counter island sits after a code block on `/markless/concepts/state`, its locator index moved
from 15 to 27 when highlighting landed, and 27 is exactly where the `div.playground` is in the
served DOM.

One detail that costs an afternoon if you miss it: inside the emitted module the HTML lives in JS
string literals, so the fence is spelled `<pre><code class=\"language-tsrx\">` there. A guard
looking for the unescaped form never matches.

### vite-plus does not call a bare `transform` function

A plugin written as `{ name, transform(code, id) {…} }` had its `buildStart` called on every
environment and its `transform` called never, silently. The same hook written as
`{ name, transform: { handler(code, id) {…} } }` runs. Anything registered here should use the
object form, and should fail loudly rather than no-op, because a hook that never runs looks exactly
like a hook with nothing to do.

### Nitro owns `plugins/`

A `plugins/` directory in the project root is scanned by Nitro as *server* plugins, and the build
dies with `"default" is not exported by "plugins/highlight-mdx.ts"`. Build-time tooling lives in
`tooling/` for that reason.

## 9. An island whose only job is `attach` never wakes

The hover docs on code tokens are plain CSS, not a Markless island, and that is not a style
preference. On a server-rendered page the inline resumer
(`node_modules/@markless/web/dist/resumer-BsPf7l9a.js`) adds one listener per event name that
appears in `view.events`, walks up from `event.target` looking for a host element the payload knows,
and only then loads the runtime. Element behaviours installed with `attach` are not listeners: they
install during resume, and resume is what has not happened yet. `hasBrowserTriggers` in
`render-to-string` does count a behaviour as a reason to ship the payload, but nothing in the
document triggers it.

So a `SyntaxTooltip.tsrx` island that used `attach` to watch for `mouseover` on the highlighted
spans would install its listener only after the reader had already clicked something else on the
page. The spans it needs to watch also sit outside the island, in static HTML the router wrote, so
they are not host elements the payload can route an event to either.

The tooltip is therefore a child element of the token it explains, shown by `:hover` and `:focus`.
It costs no JavaScript, it works on the first pointer movement rather than after a first gesture,
and it is keyboard reachable. Revisit this if a future release lets a component subscribe to events
on nodes it does not own, or wakes behaviours without an event.

## 10. Smaller things learned

- Fenced blocks are monospace (`ui-monospace, 'SF Mono', Menlo, Consolas, monospace`); inline code
  inside a sentence stays on Joy Elia so it still reads as part of the sentence.
- The tooltip is pinned to the bottom of its code block. A box that scrolls clips its children at
  the padding edge, so a tooltip positioned any other way is cut off by the block's own
  `overflow-x: auto`. The strip of padding it needs is only added while a token is hovered or
  focused (`pre.shiki:has(.tsrx-hover:hover)`), so a block at rest ends at its last line.
- The site-wide prose glossary from the reference site is not built. Highlighting and the construct
  tooltips were the must; the glossary needs a pass over the prose that this unit was told not to
  touch.

## 11. T005: an MDX island whose update has to evaluate app code never resumes

This is the finding that decides which widgets the docs can ship on 0.2.2, and it is not caused by
the highlighter: it reproduces with `tooling/highlight-mdx.ts` short-circuited to a no-op.

Two widgets on this site work. Two do not:

| widget | page | what it does | result |
| --- | --- | --- | --- |
| `counter.tsrx` | landing, state | one state, one text binding, one button | resumes, count moves |
| `two-variables.tsrx` | state | one state, two text bindings, one button | resumes, number moves |
| `cart-total.tsrx` | computed | two states, a `computed()`, three text bindings | never updates |
| `three-differences.tsrx` | reading a `.tsrx` file | one state, `class={ternary}` bindings, three buttons | never updates |

On the two that fail, every click throws in the page, twice:

```
Unknown Markless MDX symbol c0:symbol:5     (cart total)
Unknown Markless MDX symbol c0:symbol:4     (three differences)
```

The message is thrown by `loadMdxSymbol` in
`node_modules/@markless/router/dist/vite/runtime/mdx-route.js`: no child in the composed MDX view
had a `symbolPrefix` matching the id with an `output.loadSymbol` on it. The client chunk for the
widget does exist and does carry those symbols (`.output/public/build/chunk-Q3a3i8Ao.js` holds
`symbol:0` through `symbol:3` and a `loadSymbol`), so the code shipped; the MDX child registry is
what does not resolve it.

What was ruled out, each by a build and a browser run:

- **the highlighter**: same failure with the transform disabled.
- **the number of symbols on the page**: trimming the cart to one button and two bindings moved the
  failing id from `symbol:5` to `symbol:3` and changed nothing else.
- **the two-file wrapper**: `counter-demo.tsrx` wraps `counter.tsrx` exactly the same way and works.
- **having more than one button**: the one-button cart still fails.

What the two failing widgets have in common is that their update is not a value the resume payload
can write straight into the DOM. A `computed()` has to be re-derived, and a `class={a ? b : c}` has
to be evaluated, and both of those are app code. The two that work only ever write a number the
payload already holds, and their resume log agrees: `0.0 KB app executed`.

So on 0.2.2, an interactive doc widget inside `.mdx` is limited to updates the payload can perform
without executing app code. That rules out the two demos this batch needs most, since deriving a
value is the whole subject of the computed page. It wants an owner decision (ship them as static
illustrations, replace them with widgets that only move a stored number, or fix the router's MDX
symbol registration) before those two pages can be called done.

## 12. T005: smaller things

- The code theme is shiki's built-in `github-light`. `tooling/highlight-code.ts` strips the theme's
  own `<pre>` style so the block keeps the site's paper surface, and repaints the theme's default
  foreground with `var(--ink)`, so only the token colours come from the theme.
- Because token colours are now inline `style="color:#…"` rather than `--code-token-*` variables,
  anything matching on those variable names (the witness did) has to match on `color` instead.

## 13. T015: the site now builds against 0.3.0 tarballs, and finding 11 survives the move

The site no longer resolves `@markless/*` from the registry. It installs nine tarballs packed from
the framework repo's `main` at release commit `b12b7806` (every manifest at `0.3.0`), committed
under `vendor/` at 596 KB total:

```
markless-analyzer  markless-bundler  markless-compiler  markless-core  markless-router
markless-runtime   markless-serializer  markless-typescript-plugin  markless-web
```

`pnpm pack` rewrites the `workspace:`/`catalog:` ranges, so every packed manifest asks for
`@markless/<name>@0.3.0` exactly. npm would fetch those from the registry, where 0.3.0 does not
exist yet, so the five transitive ones are pinned to their tarballs through `overrides`. npm refuses
an `overrides` entry that contradicts a direct dependency (`EOVERRIDE`), so the four direct ones
carry the `file:` specifier in `dependencies`/`devDependencies` instead.

**This is interim.** When 0.3.0 is published, delete `vendor/`, delete the `@markless/*` entries
from `overrides`, and put `^0.3.0` back in `dependencies`/`devDependencies`.

Two things that did not change on the move:

- **Finding 1 still holds.** The `@tsrx/core` catalog range in the framework repo is still
  `^0.1.58`, so the packed 0.3.0 manifests still ask for `^0.1.58`, which still resolves to
  `0.1.60`, which still depends on the unpublished `@tsrx/runtime@0.1.1`. Proven by installing the
  same package.json with only the override removed: `npm error 404 ... @tsrx/runtime@0.1.1`. The
  `"overrides": { "@tsrx/core": "0.1.58" }` pin stays.
- **Finding 11 still holds.** `cart-total` and `three-differences` still never update. Same message,
  same two symbols, thrown twice per click.

`scripts/markless-doctor.mjs` compares the *installed* version of each `@markless/*` package now
rather than the declared specifier. Four `file:` tarball paths are four different strings for one
version, and two `^` ranges can resolve to two different versions, so reading the installed manifest
is both what makes the check pass here and a stricter test than the one it replaces.

## 14. T015: why an MDX island that derives a value never resumes — the prefix is dropped

Finding 11 said the two widgets fail and named what they have in common. On 0.3.0 the stack names
the mechanism, and the served payload proves it. This is a framework defect, not an app mistake, and
no app-side shape avoids it.

### What happens

Clicking either widget throws in the page, twice:

```
Unknown Markless MDX symbol c0:symbol:5      (cart total, /markless/concepts/computed)
Unknown Markless MDX symbol c0:symbol:4      (three differences, /markless/start/reading-tsrx)

Error: Unknown Markless MDX symbol c0:symbol:5
    at u (…/build/chunk-CGo67nRf.js)                       <- loadMdxSymbol
    at Object.v [as loadSymbol] (…/build/chunk-HUsBH6rf2.js)  <- marklessMdxLoadSymbol
    at Object.t [as refreshSyncComputed] (…/build/chunk-C-_1mj0H.js)
    at Object.run (…/build/chunk-ClbziJ0e.js)
```

`refreshSyncComputed` is the tell. Both failing widgets have a derived value — a `computed()` in the
cart, a `class={ternary}` in the explorer — and re-deriving it is the only path on this site that
calls `loadSymbol` at all. The two widgets that work resume with `0.0 KB app executed`: they never
ask for a symbol, so they never hit this.

### Two namespaces, one of them not applied

An MDX page gives each imported component a prefix `m0:`, `m1:`, `m2:` (`renderSymbolLoaders` in
`@markless/router` `src/vite/mdx.ts`). Inside a `.tsrx` component, the compiler gives each imported
child edge a prefix `c0:`, `c1:` (`symbolPrefix: edge.importSource ? \`c${index}:\` : ''` in
`@markless/compiler` `src/passes/public-render/`). `cart-total-demo.tsrx` is MDX component 1 and
composes `cart-total.tsrx` as its child 0, so the fully qualified id is `m1:c0:symbol:5`.

The served payload for `/markless/concepts/computed` carries both spellings:

```json
"hostNodeId":"m1:c0:h1"                                    (view payload — both prefixes)
"computed":[{"graphNodeId":"computed:total","name":"total",
             "deriveSymbolId":"c0:symbol:5", …}]           (state payload — m1: missing)
```

The view payload is right and the state payload is wrong, and the two are built by different
functions in `@markless/router` `src/vite/runtime/mdx-route.ts`:

- `composeMdxView` walks each child through `appendMdxChildView`, which applies
  `child.hostPrefix` to every `hostNodeId` and `child.symbolPrefix` to every `symbolIds` entry, and
  `prefixMdxSymbolRecord` does the same for `domUpdates` and `behaviors`. Hence `m1:c0:h1`.
- `composeMdxState` flattens `state.cells` and `state.computed` verbatim:

  ```ts
  cells: childStates.flatMap((state) => state.cells ?? []),
  computed: childStates.flatMap((state) => state.computed ?? []),
  ```

  It never sees `child.symbolPrefix`. The `deriveSymbolId` inside a computed record therefore ships
  in the child's own namespace, `c0:symbol:5`.

At resume, `refreshSyncComputed` reads `deriveSymbolId` and calls `marklessMdxLoadSymbol`. Its
`children` argument defaults to `[]` in the browser — the array `renderMdxChild` fills is a
server-side local — so the only table left is `marklessMdxSymbolLoaders`, keyed `m0:`/`m1:`/`m2:`.
Nothing starts with those, and `loadMdxSymbol` returns
`Promise.reject(new Error('Unknown Markless MDX symbol …'))`.

Emitted loader table, read out of the built page chunk:

```js
b = [{ prefix: `m0:`, loadSymbol(e) { return import(`./chunk-CLkHSEId.js`).then(t => t.loadSymbol(e.slice(3))) } },
     { prefix: `m1:`, … }, { prefix: `m2:`, … }]
```

### Minimal reproduction

Three files and a click. Nothing here is exotic; it is the shortest MDX island that derives a value.

```tsx
// components/demos/total.tsrx
export default component Total() {
  let count = state(0);
  const total = computed(() => count * 20);
  <p>{'Total: ' + total}</p>
  <button onClick={() => { count = count + 1; }}>{'Add one'}</button>
}
```

```tsx
// components/demos/total-demo.tsrx  (the wrapper MDX needs, because MDX cannot nest components)
import Total from './total.tsrx';
export default component TotalDemo() {
  <div class="playground"><Total /></div>
}
```

```mdx
{/* pages/…/anything.mdx */}
import TotalDemo from '../../components/demos/total-demo.tsrx';

<TotalDemo />
```

`npm run build`, serve `.output`, click **Add one**. The text stays at `Total: 0` and the page
throws `Unknown Markless MDX symbol c0:symbol:<n>`. Grep the served HTML for `deriveSymbolId` and
it reads `c0:symbol:<n>` while the neighbouring `hostNodeId` reads `m0:c0:h<n>`.

### The fix is in the framework, and the shape of it

`composeMdxState` has to prefix the symbol ids it copies the way `composeMdxView` already does —
`deriveSymbolId` on each computed record, and whatever equivalent a cell record carries — using the
same `child.symbolPrefix`. Once the id reads `m1:c0:symbol:5`, the `m1:` loader matches and hands
`c0:symbol:5` to the demo module's own `loadSymbol`, which is the namespace that module expects.
That last hop is the reading of the code, not something this run proved end to end; it needs a
framework test, not an app workaround.

### What this rules out for the docs

Any MDX island whose update derives a value is broken, wrapper or no wrapper. Removing the wrapper
does not help: with no child edge the id would be `symbol:5`, which still matches no `m<n>:` loader.
(That variant was reasoned from the emit, not built.) So on 0.3.0 an interactive doc widget in
`.mdx` is still limited to updates that write a stored number straight into the DOM, which is
exactly what the computed page cannot be taught with. The two pages that need these widgets stay
blocked on the framework fix.

## 15. T016: `storage()` cannot resume on 0.3.0, so the site has no theme toggle

The dark theme is finished and a reader on a dark operating system gets it. What is missing is the
control that lets anyone else choose it, and the reason is a framework defect, not a design choice.

The toggle was written the intended way: `let theme = storage('theme', 'light')` and a button whose
click assigns to it. `@markless/core`'s own playbook says that assignment persists to `localStorage`
and puts `data-theme` on `<html>`, which is exactly the hook every dark rule in `styles/global.css`
hangs off. Three placements were built and served against the production build. None of them work,
and two of them are worse than not working.

**Declared inside the component body: compile error.** `storage()` is collected only as a
module-scope graph binding (`collect-module-scope.ts` in `@markless/compiler`), so a body-scope
declaration fails the build:

```
MARKLESS_STATE_UNRESOLVED_WRITE: Cannot write to "theme" because the compiler cannot
resolve that target.
```

Declaring it at module scope compiles. That much is just an undocumented rule.

**Declared at module scope in a component the page reaches (the sidebar, or an island dropped
straight into an `.mdx` page): every island on that page dies.** The click throws twice:

```
RuntimePayloadError: Invalid markless/state storage: expected array.
```

The served `<script type="markless/state">` is the proof. A storage cell is present, the payload is
stamped `"version":2` because of it, and the `storage` array the version-2 client validator
requires is not there at all:

```json
{"version":2,"cells":[{"graphNodeId":"storage:…/theme-toggle.tsrx#theme","name":"theme",…}], …}
```

`createProtocolStatePayload` in `@markless/serializer` gets this right — it writes
`version: storage.length > 0 ? 2 : 1` and spreads `{ storage }` under the same condition — so the
records are being dropped after that, most likely by the record-delta merge the MDX child
composition runs (`optionalRecordDelta(…, 'storage', …)` in the same file). Whatever drops them
leaves the version behind, and `validateStorageRecords` on the client refuses the payload. Refusing
it takes the whole page down with it: on the landing page the counter stopped moving as well.

**Declared at module scope in `document.tsrx` itself: silently dropped.** The payload stays at
`"version":1` and carries no storage cell at all, so nothing throws and the button does nothing.

So `storage()` is unusable on 0.3.0 in every position an app can put it, and there is no app-side
shape that avoids it. The fix is in the framework: whatever composes the child state payload has to
carry the `storage` records the way it carries `cells`, or leave the version at 1 when it does not.

What the site does instead: `styles/global.css` keys the dark theme off `html[data-theme='dark']`,
which is precisely the attribute `storage('theme', …)` writes, with
`@media (prefers-color-scheme: dark)` as the default for a reader who has not chosen. The day the
payload defect is fixed, the toggle is this file plus one `<ThemeToggle />` in the sidebar:

```tsx
// components/docs/theme-toggle.tsrx
import { storage } from '@markless/core';

let theme = storage('theme', 'light');

export default function ThemeToggle() @{
	<button
		class="theme-toggle"
		type="button"
		aria-label="Switch between the light and dark theme"
		onClick={() => {
			theme = theme === 'dark' ? 'light' : 'dark';
		}}
	>
		<span class="theme-toggle-face is-light" aria-hidden="true">☀</span>
		<span class="theme-toggle-face is-dark" aria-hidden="true">☾</span>
		<span class="theme-toggle-word is-light">Dark</span>
		<span class="theme-toggle-word is-dark">Light</span>
	</button>
}
```

The witness proves both themes by setting `data-theme` itself, which is the same switch the button
would throw, and writes `T016-index-light.png`, `T016-index-dark.png`, `T016-state-light.png` and
`T016-state-dark.png` into the goal notes.

## 16. T016: the hover doc is a popover now, and what had to change to allow it

Finding 10 said the doc was pinned to the foot of its code block because a box that scrolls clips
its children. That was true and it looked wrong: the explanation of a token on line two appeared
five lines below it, and the block grew by three lines while a token was pointed at.

It is now a popover directly above the token (`.tsrx-hover { position: relative }`, the doc at
`bottom: calc(100% + 0.35em); left: 0`, `max-width: 36ch`), and the `pre.shiki:has(.tsrx-hover:hover)`
padding trick is gone, so the block is exactly the same height at rest and while hovered. The
witness measures that: `91.6px then 91.6px`.

The clipping problem is real and CSS alone cannot solve it in general — `overflow-x: auto` forces
`overflow-y` to `auto` too, and the doc is a child of the token, which is inside the scroller. So
the block is taken out of the scroller where the browser can do it: under
`@supports (anchor-scope: --tsrx-token)` the doc becomes `position: fixed` and pins itself to the
token with `position-anchor`, which is not clipped by any ancestor. `anchor-scope` is what makes
that safe with one shared anchor name — it limits the name to the token's own subtree, so every doc
finds its own token instead of the last one on the page. Chrome 131 and later take that path.
Without it the doc is placed against the token and a token on the *first* line of a block has its
doc clipped by the block's top edge. That is the whole of the degradation.

**Fenced code was not actually monospace.** `* { font-family: 'Joy Elia' }` matches the token spans
shiki emits *directly*, and a direct match beats a family inherited from `pre`, so every block was
being painted in the display face while `getComputedStyle(pre).fontFamily` reported the monospace
stack. The rule now names `.prose pre`, `.prose pre code` and `.prose pre code span`, and the
witness reads the computed family off all three: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.

## 17. T016: two code themes from one highlighter, and the sprite cut-outs

`tooling/highlight-code.ts` asks shiki for `{ light: 'github-light', dark: 'github-dark' }` with
`defaultColor: 'light'`. That leaves the light output byte-for-byte what the single-theme mode
produced and adds one `--shiki-dark: #…` declaration to each span. The dark theme reads the other
channel. It has to do it with `!important`, because the colour is an inline style and nothing else
outranks that; the alternative was to stop emitting `color` at all, which would have changed the
light output.

The sprites and the mascots are cut by `tooling/cut-sprites.ts` (ImageMagick 7, run by hand). Two
things worth knowing about the assets:

- Every sprite ships twice: `public/sprites/<name>.png` as drawn, and `<name>.dark.png` with the
  dark crayon outline lifted to chalk so it still reads on the dark ground. CSS cannot swap an
  image `src`, so `components/sprite.tsrx` puts both in the markup and the `--sprite-light` /
  `--sprite-dark` tokens decide which one is painted.
- The mascots carry their own white sticker outline and read on either ground, so there is one file
  each. The one imperfect crop is **frameless**: the red loop arrow to the right of the stamp is
  clipped at the edge of the cut. It is not worth another pass; recut it if the owner disagrees.

`components/docs/more-from-compiled.tsrx` links the four projects. **versionless has no public
repository** (checked 2026-08-17), so it points at `https://github.com/compiled-run` as a
placeholder for the owner to replace.

## 18. T019: the two router fixes land, and what is left is a class binding

The site is now on tarballs that carry two framework fixes (see the README for which commit).
`markless-router-0.3.0.tgz` and `markless-serializer-0.3.0.tgz` were repacked from the fix branch;
the other seven are unchanged from the release commit, because a rebuild of them produced only new
content-hash chunk names and a different key order in `package.json`.

**Finding 14 is fixed.** `composeMdxState` now prefixes `deriveSymbolId` with the child's
`symbolPrefix`, so `cart-total` resumes: the total moves 20 -> 40 -> 48 on the computed page and the
witness asserts it for real again, no allowlist.

**Finding 15 is fixed.** Storage records compose through MDX state and the version is recomputed from
what the payload carries, so `storage()` resumes. The theme toggle is on the site (finding 19).

**What is still broken is narrower and is not the same defect: a `class={ternary}` binding produces
no dom update at all.** `three-differences` half works now — the sentence under the file swaps,
because that is a text binding — but the highlighted line never moves.

The evidence is the compiled component's own artifact, before any MDX composition. In
`.output/server/_ssr/chunk-*.mjs` for `components/demos/three-differences.tsrx`:

```json
"domUpdates": [{
  "hostNodeId": "h14",
  "graphNodeId": "computed:templateExpression:0",
  "target": { "kind": "text" },
  "symbolId": "symbol:3"
}]
```

One record, for the sentence. The eight `class={picked === '…' ? 'file-line is-lit' : 'file-line'}`
bindings and the three `class={…}` bindings on the buttons leave nothing behind. The served view
payload for the page agrees: five `domUpdates`, every one of them `"target":{"kind":"text"}`, and no
record whose target kind is `class`.

So this is not the MDX path and not the symbol namespace. The compiler has the machinery — its
`bindingTargetForAttribute` returns `{ kind: 'class' }` for a `class` attribute, and
`conditionalClassTarget` recognises exactly the `cond ? 'a' : 'b'` shape these bindings use — but no
record for it reaches the payload. Reproduce it with any island that has one state and one
`class={state === x ? 'a' : 'b'}`: click, and nothing throws, nothing loads, and the class does not
change. The browser console prints `0.0 KB app executed`, because the resume was never asked to do
anything.

The witness keeps checking it under `knownFailingReason = 'NOTES.md finding 18'`, scoped to the one
check it breaks, so the run goes green on its own the day the compiler emits the record.

## 19. T019: the theme toggle is an island each page renders, not part of the header

The toggle works: click it and `data-theme` moves on `<html>`, the palette repaints, the choice is
in `localStorage`, and it survives a reload. The seed script the router now emits reaches the head,
so there is no flash. The witness asserts all of that.

**It is not a child of the header, and it cannot be.** `components/docs/site-header.tsrx` is composed
from `document.tsrx`, and the router serves only the document's HTML — it drops the document's state
payload — so a `storage()` cell anywhere on the document path can never resume. The router now says
so outright instead of serving a dead control:

```
MARKLESS_ROUTER_DOCUMENT_STORAGE_UNSUPPORTED: the document declares storage cells (theme), but the
router serves only the document's HTML, so their state payload never reaches the browser
```

So `components/docs/theme-toggle.tsrx` is an island each `.mdx` page renders as a top-level block,
placed just under `<PageMeta />`. The header keeps a `.theme-toggle-slot` — an empty span at the end
of the tools row — and `.theme-toggle-island` is `position: fixed` against the header's own inline
padding, which is the one number both rules can name. The witness compares the two boxes rather than
trusting the arithmetic. The two `.tsrx` error pages have no toggle, because they are not MDX.

Two shapes in that component are forced rather than chosen:

- **Two buttons, not one.** A single button would derive its label from the current value, and a
  derived class binding does not resume (finding 18). Each button assigns one constant instead, and
  CSS shows whichever matches the painted theme, using the palette's own selectors.
- **The fallback is `system`, not `light`.** The seed script stamps the fallback when nothing is
  stored, so a `light` fallback would override `@media (prefers-color-scheme: dark)` for every reader
  who never chose. `html:not([data-theme='light'])` already reads `system` as "ask the operating
  system", so the existing dark rules needed no change.

One thing worth reporting upstream: the seed script ships the slot key verbatim, and the slot key is
the component's **absolute path on the build machine**:

```
["/Users/…/compiled-website/components/docs/theme-toggle.tsrx#theme","theme","data-theme","system"]
```

That is a build-machine path in the served HTML of every page.

## 20. T019: `@if` and `@for` render nothing inside a page component either

Finding 3 said `@for` renders nothing on the document path. It is not the document path. Neither
construct renders anything **inside a page component either**, which is why `components/page-meta.tsrx`
writes its three "Assumes:" slots out by hand and hides the unused ones instead of looping.

Reproduction, from the T017 attempt at that line: the loop that should have produced one link per
concept key

```tsx
@for (const item of assumed.items; key item.href) {
	<a class="page-meta-assume-link" href={item.href}>{item.title}</a>
}
```

emitted `<span></span>` — an empty element where the links should be — with `assumed.items` a plain
array of two objects built in ordinary TypeScript directly above. Static markup in the same position
renders, and the same array printed as text renders, so the data is there and the construct is what
produces nothing. `@if` behaves the same way in that position.

This is under investigation in the framework. Until it is fixed, every list on this site is written
out as fixed slots (the sidebar in finding 3, the assumes line here) with plain TypeScript deciding
what goes in them, which is why `nav.ts` exists.

## 21. T013: a component that uses `@if` or `@for` hangs the build

Finding 20 said neither construct renders anything inside a page component. On the tarballs this
site is pinned to the failure is worse than that and it is not silent: **a component that uses
`@if` or `@for` makes the production build stop making progress.** `vite … building client
environment for production` prints `transforming...` and nothing else ever appears. It is not a
runaway loop. `sample` on the build process shows every thread parked in `uv__io_poll` and the
rolldown workers idle, which is a promise in the plugin pipeline that never settles rather than
work being done.

The bisect, one build per step, from a clean `.output`:

| tree | result |
| --- | --- |
| `main` with no batch-2 content | builds, ~90 s |
| plus `concepts/events.mdx` and its `name-echo` island (state, `onInput`, `onSubmit`) | builds |
| plus `concepts/conditionals.mdx` with an island whose body has `@if (open) { … }` | hangs, killed at 5 min |
| the same page with the `@if` island that declares no state inside the branch | hangs, killed at 5 min |

So the trigger is `@if` in a compiled component, not the state-inside-a-branch shape the page was
written to teach. `@for` was not reached in the bisect and is treated as the same defect until
someone proves otherwise; the loop island was withdrawn with the conditional ones.

The reproduction is two files. `components/demos/draft-kept.tsrx`, deleted in this change, was:

```tsx
import { state } from '@markless/core';

export default function DraftKept() @{
	let open = state(false);
	let draft = state('');

	<section>
		<button onClick={() => (open = !open)}>Toggle the panel</button>

		@if (open) {
			<label class="echo-field">
				Your message
				<input value={draft} onInput={(event) => (draft = event.currentTarget.value)} />
			</label>
			<p class="playground-output">Draft: {draft}</p>
		}
	</section>
}
```

Import that from an `.mdx` page as a top-level block and run `npm run build`.

**What it costs the docs.** `concepts/conditionals.mdx` and `concepts/lists.mdx` ship with their
files in fences and a callout that says plainly why there is no box to click, in the shape the T011
outline reserved for exactly this case. The witness asserts that callout is present and that neither
page carries a `.playground` frame, so the day the compiler accepts these components the witness
goes red and the note has to be removed with the same change that brings the widgets back. The two
teaching components and their wrappers were deleted rather than left unimported, because a dead
`.tsrx` in `components/demos/` reads as a shipped demo.

**What still works.** State, computed, events, `storage()` and class-free text bindings are all
unaffected: `concepts/events.mdx` builds, resumes and is witnessed clicking. Nothing here changes
findings 18, 19 or 20; this is the same family as 20, found from the build side.

## 22. T027: the site is on published 0.3.1, and the `@tsrx/core` pin is the only one left

`@markless/*` 0.3.1 is on npm, so the interim tarball vendoring of finding 13 is over. `vendor/` and
its nine tarballs are deleted, the five `@markless/*` `overrides` entries are gone, and the four
packages the app names carry `^0.3.1`:

```
@markless/analyzer@0.3.1  @markless/bundler@0.3.1  @markless/compiler@0.3.1  @markless/core@0.3.1
@markless/router@0.3.1  @markless/runtime@0.3.1  @markless/serializer@0.3.1  @markless/web@0.3.1
@markless/typescript-plugin@0.3.1
```

(`npm ls` after `rm -rf node_modules package-lock.json && npm install`; every node in the tree reads
0.3.1.)

**The two fixes the site was carrying on repacked tarballs are in the release.** The witness runs
green against the registry build with no allowlist beyond the one below: the cart total on the
computed page still moves 20 -> 40 -> 48 (finding 14's defect, fixed), and the theme toggle still
writes `data-theme`, persists to `localStorage` and survives a reload (finding 15's defect, fixed).

**Finding 18 is still open on 0.3.1 and is the one known-failing check.** `class={ternary}` produces
no dom update, so the highlighted line on the reading-a-`.tsrx` page never moves; the witness keeps
it under `knownFailingReason = 'NOTES.md finding 18'`. The compiler fix for it landed on the
framework's `main` after the 0.3.1 cut and is expected in 0.3.2, at which point that check passes,
the witness goes red on the stale allowlist, and the note comes out with it.

**Finding 1 survives, and was re-proven rather than assumed.** Installing this `package.json` with
`"overrides": { "@tsrx/core": "0.1.58" }` removed and nothing else changed:

```
npm error 404 Not Found - GET https://registry.npmjs.org/@tsrx%2fruntime - Not found
npm error 404  The requested resource '@tsrx/runtime@0.1.1' could not be found
```

`@markless/compiler@0.3.1` asks for `@tsrx/core@^0.1.58`, which resolves to `0.1.60`, which depends
on the unpublished `@tsrx/runtime@0.1.1`. The pin stays until either the framework's catalog range
stops floating past `0.1.58` or `@tsrx/runtime` is published.

## 23. T027: `@if` still hangs the build on published 0.3.1, and here is the module it stalls on

Finding 21 found the hang on the vendored 0.3.0 mix and could not say whether the tarball mixture
was to blame. It is not. On a clean install of published `@markless/*@0.3.1` the same two-file
reproduction hangs the same way, and this time the stuck module is named.

**The reproduction, unchanged from finding 21.** `components/demos/draft-kept.tsrx`:

```tsx
import { state } from '@markless/core';

export default function DraftKept() @{
	let open = state(false);
	let draft = state('');

	<section>
		<button onClick={() => (open = !open)}>Toggle the panel</button>

		@if (open) {
			<label class="echo-field">
				Your message
				<input value={draft} onInput={(event) => (draft = event.currentTarget.value)} />
			</label>
			<p class="playground-output">Draft: {draft}</p>
		}
	</section>
}
```

plus the wrapper MDX needs (`draft-kept-demo.tsrx`, a `<div class="playground">` around
`<DraftKept />`) and a one-line `.mdx` page that imports the wrapper as a top-level block.
`npm run build` prints

```
vite v8.0.10 building client environment for production...
transforming...
```

and then makes no further progress. Killed at 248 s. Every other page on this site builds in well
under 90 s, so this is the same "never settles" signature, not slowness.

**Which module.** `DEBUG=vite:*` is no help on Vite 8 — it dumps the resolved config and then goes
quiet, because the per-module work happens in rolldown's Rust workers and never reaches the
`vite:transform` debug channel. What does work is a pair of trivial local plugins, one with
`transform: { order: 'pre' }` and one with `order: 'post'`, each appending `ENTER <id>` / `DONE <id>`
to a file. Diff the two sets after the kill and exactly five ids are entered and never finished:

```
<site>/components/demos/draft-kept.tsrx
<site>/components/demos/draft-kept-demo.tsrx
<site>/components/demos/draft-kept-demo.tsrx?markless-render-data
<site>/components/demos/draft-kept-demo.tsrx?markless-symbols
<site>/components/demos/draft-kept-demo.tsrx?markless-render-data&markless-reached-from=<site>/pages/markless/concepts/probe.mdx
```

679 transform records in total; those five are the only ones with no `DONE`. The base id
`draft-kept.tsrx` — the component that contains the `@if`, before any MDX composition — is entered
and never returns, and the four wrapper ids are the ones waiting on it. No id belonging to any other
page appears in the unfinished set, which is why the rest of the site is unaffected and why the two
pages can ship without their widgets.

So the framework bug to chase is inside the transform of a `.tsrx` module whose body contains an
`@if` block: it returns a promise that never settles rather than throwing. `sample` on the build
process confirms the process is parked in `uv__io_poll` with the rolldown workers idle, exactly as
finding 21 described.

**What it still costs the docs.** `concepts/conditionals.mdx` and `concepts/lists.mdx` keep their
files in fences and their "why there is no demo box" callouts, and the witness keeps asserting both
the callout and the absence of a `.playground` frame on those two pages. The plan in the T011
outlines (outline 7's `DraftPanel` pair, outline 8's `SortableRows`) is unchanged and waiting; it
needs a framework fix, not another app-side shape.

Note that this is a different defect from the `@for`-renders-nothing one that 0.3.1 fixed. That fix
was about a repeat over a plain collection rendering zero rows at run time; this is a build that does
not finish at all.

## 24. T027: the sidebar and the assumes line are loops again, and `<Html>` still is not usable

0.3.1 fixes `@for` over a plain collection (a module constant, an imported constant, an inline
array), which is what findings 3 and 20 ran into. Both workarounds built on that defect are retired
and both are proven by a build and the witness, not by reading the release note:

- **The sidebar loops `nav.ts`.** `components/docs/sidebar.tsrx` was thirty lines of hand-written
  `<li>`s that had to be kept in step with `nav.ts` by hand. It is now two nested `@for`s —
  `@for (const section of nav; key section.title)` around
  `@for (const entry of section.entries; key entry.href)` — and `nav.ts` carries the sprite name and
  the in-section number for each entry, so the file that the breadcrumb and the pager already read
  is now the only place a page is listed. The served HTML for `/markless/concepts/state` has all
  seven `sidebar-text` titles in reading order and exactly one `sidebar-link is-active`.
- **The assumes line loops its items.** `components/page-meta.tsrx` printed three fixed slots and
  hid the unused ones. It now loops `assumesFor(assumes)`, so there is no slot limit and no hidden
  markup, and `assumesLine`, `AssumesSlot`, `AssumesLine`, `slotFor` and the overflow warning are
  gone from `nav.ts`. The witness's existing assertions on that line ("the assumes line has the
  links it should", and that each link answers 200) pass unchanged.

One shape rule worth writing down, learned from the first failed build: **a `@for` body renders a
single node.** Three siblings inside the loop fails the build with `A code block renders a single
node; wrap multiple nodes or text in a fragment '<>…</>'`, ten times over. The assumes item is
wrapped in one `<span class="page-meta-assume">` for that reason.

**`<Html>` is still unusable, so finding 2's workaround stays.** Swapping `document.tsrx`'s plain
`<html>` root for `<Html>` from `@markless/router` on 0.3.1 fails the build in the same place it did
on 0.2.2:

```
[UNLOADABLE_DEPENDENCY] Error: Could not load @markless/router - No such file or directory (os error 2).
```

The document keeps its plain `<html>` root.

## 25. T014: `@try` builds fine, but an async boundary inside an MDX page never resumes

Good news first, because finding 23 predicted the opposite: **a component whose body uses
`@try` / `@pending` / `@catch` does not hang the build.** The `@if` hang is specific to `@if`. The
async widget below built in the ordinary 90 seconds, twice, on published 0.3.1.

The widget (`slow-greeting.tsrx`, now deleted, kept here so the page can come back):

```tsx
import { computed, state } from '@markless/core';

export default function SlowGreeting() @{
	let wait = state(30);

	const greeting = computed(async () => {
		const ms = wait;
		await new Promise<void>((settle) => {
			setTimeout(settle, ms);
		});
		return `Ready after ${ms} milliseconds`;
	});

	<section class="waiting">
		<div class="playground-controls">
			<button onClick={() => (wait = 30)}>Fast</button>
			<button onClick={() => (wait = 2500)}>Slow</button>
		</div>
		@try {
			<p class="playground-output">{greeting}</p>
		} @pending {
			<p class="playground-output is-waiting">Still working on it</p>
		} @catch {
			<p class="playground-output is-failed">That did not work</p>
		}
	</section>
}
```

**Defect A: inside an MDX page the boundary is not resumable.** Served through
`pages/markless/concepts/probe.mdx` (a one-line page whose only content is the wrapper), the SSR
HTML is right: the arm's `<p>` is there, wrapped in
`<!--markless:async:c0:boundary:0-->` comments, holding `Ready after 30 milliseconds`. The state
payload is right too: `state:wait` is 30 and `computed:greeting` carries a fulfilled snapshot with
its dependency on `state:wait`. What is missing is in the view payload:

```json
"locators":[
 {"hostNodeId":"m0:h0","index":2,"tagName":"div"},
 {"hostNodeId":"m0:c0:h0","index":3,"tagName":"section"},
 {"hostNodeId":"m0:c0:h1","index":4,"tagName":"div"},
 {"hostNodeId":"m0:c0:h2","index":5,"tagName":"button"},
 {"hostNodeId":"m0:c0:h3","index":6,"tagName":"button"}],
"domUpdates":[{"hostNodeId":"m0:c0:h4","graphNodeId":"computed:greeting","path":["value"],
 "target":{"kind":"text"}}],
"asyncBoundaries":[]
```

`asyncBoundaries` is empty, and the one dom update names `m0:c0:h4`, a host node that has no
locator. So the click lands, `wait` changes, and nothing on the page can move: the runtime has no
way to find the node it is supposed to write. Chrome shows no error and no app chunk executed.

Clicking on a page that also carries `<PageMeta>` and `<ThemeToggle>` additionally throws
`RuntimeResumeError: Resume locator m1:h1 expected <button> at DOM order index 17 but found
<span>`, which looks like the same missing-node accounting seen from the other side.

**The same component on a plain `.tsrx` page works.** `pages/markless/probe2.tsrx` rendering the
identical boundary re-settles for real: click Slow and the text goes from `Ready after 30
milliseconds` to `Ready after 6000 milliseconds`. So this is the MDX composition path, not the
async boundary itself, which is the same shape of defect as findings 11 and 14.

**Defect B: a re-settle never shows `@pending`.** On that working `.tsrx` page, with the slow
branch waiting six seconds, the arm text was polled every 60 ms for eight seconds and only ever
held two values: the old settled text, then the new one. `Still working on it` was never on the
page. `specs/framework/12-arm-rendering.md` D8 says a boundary holds its prior settled snapshot and
that "past the client deadline the boundary's `@pending` arm commits"; on 0.3.1 the commit does not
happen at six seconds, which is well past any plausible deadline. Not chased further here: it needs
the framework's own timing tests, not an app-side probe.

**What it costs the docs.** `concepts/async.mdx` ships prose-only, with the boundary in fences and
two callouts: one saying why there is no demo box, one saying which of the deadline claims are
quoted from the specification rather than measured on this site. The witness asserts both callouts
and the absence of a `.playground` frame, so the day the payload carries the boundary the run goes
red and the notes come out with the fix.

## 26. T014: scoped `<style>` CSS is compiled and then never linked, and a class expression drops the scope class

Two separate defects found while building the styling page's widget. Both were reproduced on a
plain `.tsrx` page as well as through MDX, so neither one is the MDX path.

**Defect A: the compiled stylesheet does not reach the page.** Two components, each with its own
`<style>` block defining `.card` in a different colour, rendered side by side. The build does its
half of the job:

```
.output/public/assets/two-cards-C5WZ5NFF.css
.output/public/assets/_virtual_markless_style__…_second-card-Dnqo-zvt.css
```

The served page links exactly one stylesheet, `global-Dv_xs8Qd.css`, and neither of those two. Both
cards paint `rgba(0, 0, 0, 0)`, before and after resume, on the MDX page and on the `.tsrx` page.
The plausible mechanism is that the scoped CSS is imported by the component's client chunk, and a
page whose islands execute no app code at load (`0.0 KB app executed`) never fetches that chunk, so
the CSS never arrives; but that is a hypothesis, and the measured fact is only that the link is
absent.

**Defect B: `class={expression}` is emitted without the scope class.** In the same pair, the card
whose class is a state read goes out as `class="card"` and the card with a literal class goes out as
`class="card mk-1a6qykh"`. So even once defect A is fixed, a component that mixes a `<style>` block
with a class expression will not match its own scoped rules. The scope class on the static path is
real and correct, which is the half of the story the styling page is able to state as fact.

Worth pairing with finding 18: a `class={ternary}` binding produces no dom update at all. A plain
`class={stateVariable}` binding **does** update. On the toggle above the attribute really moved from
`card` to `card is-lifted` on click, so the defect in 18 is the conditional shape, not class
bindings as a category.

**What it costs the docs.** `concepts/styling.mdx` ships prose-only: the two card files in fences,
the scope-class mechanism quoted from `specs/framework/01-tsrx-host-contract.md`, and a callout
naming both defects. The witness asserts the callout and the absence of a `.playground` frame.
