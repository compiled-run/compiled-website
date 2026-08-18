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

- Code blocks keep the site's Joy Elia face rather than switching to a monospace stack. Nothing
  forced that; it is just the look the rest of the site already had, and it is a one-line change in
  `styles/global.css` if it should be monospace instead.
- The tooltip is pinned to the bottom of its code block, and the block reserves a strip of padding
  under the code for it. A box that scrolls clips its children at the padding edge, so a tooltip
  positioned any other way is cut off by the block's own `overflow-x: auto`.
- The site-wide prose glossary from the reference site is not built. Highlighting and the construct
  tooltips were the must; the glossary needs a pass over the prose that this unit was told not to
  touch.
