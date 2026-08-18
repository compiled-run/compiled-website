# compiled-website

The Markless documentation site, served at `compiled.run/markless`. It is a real Markless app built
on released `@markless/*` packages, so everything on it is doing what a reader's own app would do.

## Where the framework comes from right now

**Interim.** The site is on `@markless/*` 0.3.0, which is not on npm yet, so it installs nine
tarballs committed under `vendor/`. The four packages the app names directly carry a
`file:vendor/…tgz` specifier; the five they pull in transitively are pinned to their tarballs through
`overrides`, because otherwise npm would go looking for 0.3.0 on the registry and not find it.

Seven of the nine are packed from the framework repo's `main` at release commit `b12b7806`.
`markless-router-0.3.0.tgz` and `markless-serializer-0.3.0.tgz` are packed from the fix branch
`worktree-agent-a69a84d1a53118f1d` at `a87f9f74`, which is `b12b7806` plus the two fixes the site
needed: MDX state composition now prefixes `deriveSymbolId`, so an island that derives a value
resumes, and it carries `storage()` records, so the theme toggle works. Rebuilding the other seven
from that commit changed nothing but content-hash chunk names, so they were left alone. When that
branch merges, repack all nine from one commit.

When 0.3.0 is published: delete `vendor/`, drop the `@markless/*` entries from `overrides`, and put
`^0.3.0` back in `dependencies` and `devDependencies`.

The `"@tsrx/core": "0.1.58"` override is not interim in the same way — it works around an
unpublished `@tsrx/runtime`, and 0.3.0 still needs it. `NOTES.md` findings 1 and 13 have the detail.

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
- `components/docs/Sidebar.tsrx`, `document.tsrx`, `nav.ts` — the chrome.
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

`NOTES.md` records what 0.2.2 and then 0.3.0 could and could not do while this was built. Read it before
changing the shell or the build config.
