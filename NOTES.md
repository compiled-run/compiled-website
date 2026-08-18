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
