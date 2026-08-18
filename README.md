# compiled-website

The Markless documentation site, served at `compiled.run/markless`. It is a real Markless app built
on the published `@markless/*` packages, so everything on it is doing what a reader's own app would
do.

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
`playwright-core`. It writes screenshots into the markless repo's goal notes.

## Layout

- `pages/markless/**.mdx` — one file per page. Prose is markdown; interactive pieces are default
  exports of `.tsrx` files, imported at the top and used as top-level blocks.
- `components/demos/` — the demos. `Counter.tsrx` is the teaching component shown verbatim on the
  page; `CounterDemo.tsrx` wraps it in the playground frame, because MDX cannot nest components.
- `components/docs/Sidebar.tsrx`, `document.tsrx`, `nav.ts` — the chrome.
- `styles/global.css` — the look, copied from the markless repo's `docs/` app.

`NOTES.md` records what published 0.2.2 could and could not do while this was built. Read it before
changing the shell or the build config.
