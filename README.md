# compiled-website

The Markless documentation site, served at `compiled.run/markless`. It is a real Markless app built
on released `@markless/*` packages, so everything on it is doing what a reader's own app would do.

## Where the framework comes from

The site installs `@markless/*` `^0.3.1` from npm. There is no `vendor/` directory and no
`@markless/*` override any more: the interim tarball vendoring described in `NOTES.md` findings 13
and 18 is closed, because 0.3.1 is published and carries the two fixes the site was waiting on (MDX
state composition prefixes `deriveSymbolId`, so a derived island resumes; `storage()` records
compose through MDX state, so the theme toggle works).

`scripts/markless-doctor.mjs` compares the *installed* version of each `@markless/*` package, so a
`^` range that resolved somewhere unexpected fails the check rather than passing on the string.

**To move to the next release**, say 0.3.2: change the four `^0.3.1` ranges in `dependencies` and
`devDependencies`, then `rm -rf node_modules package-lock.json && npm install`, then
`npm run build && npm run doctor && npm run witness`. The witness is the thing that tells you what
the release actually changed: a check that was `known-failing` and now passes fails the run on
purpose, so the note explaining the failure has to be removed in the same change set. On 0.3.1 the
one known failure is the `class={ternary}` binding on the reading-a-`.tsrx` page (`NOTES.md`
finding 18), fixed on the framework's `main` and expected in 0.3.2.

The `"@tsrx/core": "0.1.58"` override is the one pin that stays. `@markless/compiler` asks for
`@tsrx/core@^0.1.58`, which resolves to `0.1.60`, which depends on `@tsrx/runtime@0.1.1` — a package
that is not on npm. Proven on 0.3.1 by installing this same `package.json` with only the override
removed: `npm error 404 Not Found - GET https://registry.npmjs.org/@tsrx%2fruntime`. `NOTES.md`
findings 1 and 22 have the detail.

## Run it

```sh
npm install
npm run dev        # dev server
npm run build      # production build into .output/
npm run preview    # serve the production build
```

Pages live under `pages/markless/`, which is what puts them at `/markless/…`; `vite.config.ts` sets
the matching `base` and `nitro.baseURL`.

## Checks

```sh
npm run doctor     # environment and build sanity (from create-markless)
npm run witness    # builds must exist: serves .output, curls the routes, clicks a demo in Chrome
```

`npm run witness` needs a production build first (`npm run build`) and uses system Chrome through
`playwright-core`. It checks the routes answer, that the code blocks are really highlighted, that a
TSRX token shows its hover doc, and that the Counter island still resumes on a page whose first code
block sits above it. It writes screenshots into the markless repo's goal notes.

## Layout

- `pages/markless/**.mdx` — one file per page. Prose is markdown; interactive pieces are default
  exports of `.tsrx` files, imported at the top and used as top-level blocks.
- `components/demos/` — the demos. `Counter.tsrx` is the teaching component shown verbatim on the
  page; `CounterDemo.tsrx` wraps it in the playground frame, because MDX cannot nest components.
- `components/docs/sidebar.tsrx`, `document.tsrx`, `nav.ts` — the chrome. `nav.ts` is the single
  source for the page list: the sidebar loops it, and the breadcrumb, the pager and the witness read
  it. Adding a page means adding an entry there and nothing else. `document.tsrx` keeps a plain
  `<html>` root rather than `<Html>` from `@markless/router`, which still fails the build on 0.3.1
  (`NOTES.md` findings 2 and 24).
- `styles/global.css` — the look, copied from the markless repo's `docs/` app, plus the code-block
  palette, the hover-doc box and the dark theme.
- `components/sprite.tsrx`, `components/mascot.tsrx` — the hand-drawn accents. `public/sprites/`
  and `public/mascots/` hold the cut assets; `tooling/cut-sprites.ts` is what cut them and is not
  part of the build.
- `tooling/` — build-time code. `highlight-mdx.ts` is a Vite plugin registered after `router()`;
  `highlight-code.ts` runs shiki; `tsrx-docs.ts` holds the one-sentence explanation of each TSRX
  token; `tsrx.tmLanguage.json` is the TSRX TextMate grammar. It is not called `plugins/` because
  Nitro claims that name for server plugins.

## Code blocks

Fenced code is highlighted at build time. `tooling/highlight-mdx.ts` finds the static HTML in the
module the router emits for each `.mdx` page, hands every `<pre><code class="language-…">` block to
shiki, and puts the result back, recounting the elements so the islands further down the page still
resume against the right nodes.

Supported fences: `tsrx`, `ts`, `tsx`, `js`, `json`, `css`, `sh`, `bash`, `html`. A fence in any
other language is left as plain `<pre><code>`.

Colours are not chosen by shiki. The theme is shiki's CSS-variable theme under a `--code-` prefix,
and every one of those variables is defined in `styles/global.css` from the site's paper tokens, so
the palette lives with the rest of the design.

In a `tsrx` fence, the TSRX constructs and the framework calls carry a hover doc: point at `@if`,
`state`, `attach` or an `onClick`-style prop, or tab to it, and one sentence explains it. The
sentences live in `tooling/tsrx-docs.ts`. There is no JavaScript behind them; the box is a child of
the token, shown by CSS on hover and on focus. `NOTES.md` section 9 says why it is not an island.

## Themes

The dark theme is the paper design with the ground and the ink swapped and the same four pastel
accents. It is keyed off `html[data-theme='dark']`, with `@media (prefers-color-scheme: dark)` as
the default for a reader who has not chosen.

`components/docs/theme-toggle.tsrx` is the control, and `storage('theme', 'system')` is the whole of
it: assigning to that binding writes `localStorage.theme` and stamps `data-theme` on `<html>`, and
the seed script the router puts in the head applies the stored value before the first paint, so the
theme never flashes.

The toggle is an island each `.mdx` page renders rather than part of `site-header.tsrx`, because the
router serves only the document's HTML and drops its state payload, so nothing on the document path
can resume. The header reserves `.theme-toggle-slot` at the end of its tools row and the island is
pinned to it. `NOTES.md` finding 19 has the reasoning, including why the component has two buttons
instead of one.

Four pages ship without a live widget, each for a reason the page states out loud and the witness
asserts. `concepts/conditionals.mdx` and `concepts/lists.mdx`: a component whose body uses `@if`
makes the production build stop making progress on 0.3.1, and the transform that never returns is
named in `NOTES.md` finding 23. `concepts/async.mdx`: `@try` blocks build fine, but an async
boundary inside an MDX page serves no `asyncBoundaries` entry and no locator for the nodes in its
arms, so nothing on the page can move (finding 25). `concepts/styling.mdx`: the scoped stylesheet a
component compiles to is written into the build output and never linked from the page, and an
element whose `class` is an expression is emitted without its scope class (finding 26). In every
case the witness asserts both the callout and the absence of a demo frame, so the day the framework
accepts those components the run goes red and the note has to come out with the fix.

`start/first-app.mdx` has no widget by design: it is a terminal transcript, and a fake terminal
would be a lie.

`NOTES.md` records what 0.2.2, then 0.3.0, then 0.3.1 could and could not do while this was built.
Read it before changing the shell or the build config.
