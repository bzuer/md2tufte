# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What This Is

`md2tufte` is a static site built with **Astro** and **Tufte CSS**. The author writes
Markdown in `content/` and the site renders it — preserving a custom sidenote /
margin-note syntax — with no extra authoring steps. The published example lives at
`cruz.rio.br/md2tufte`.

The core goal is **technological invisibility**: the author edits `content/index.md`
(and other `content/*.md` files) and the system renders it. Preserve that workflow.
One command runs a hot-reloading dev server; publishing is a build + sync step, not a
manual multi-step deploy.

> Heads-up on naming: the repo and public URL are `md2tufte`, but the internal
> `package.json` name is `md2html`, and the deploy/infra paths follow that name
> (`/var/www/md2html`, remote `/home/server/md2html`, Nginx `md2html.conf`). This is
> intentional legacy naming — don't "fix" it without reason.

## Project Structure

- `content/` — Markdown source (the author's writing; keep edits confined here unless
  changing the pipeline or layout).
  - `content/index.md` — home page, read directly by `src/pages/index.astro`.
  - Any other `content/*.md` maps to `/{filename}` via `src/pages/[slug]/index.astro`
    (e.g. `content/md2tufte.md` → `/md2tufte`).
  - `content/img/` — image assets, referenced in Markdown as `/static/img/...`.
- `src/pages/` — Astro routes.
- `src/layouts/BaseLayout.astro` — shared HTML shell (KaTeX CSS, hashed stylesheet
  link, skip link, landmark structure, deferred `main.min.js`).
- `src/lib/` — the Markdown rendering pipeline (`remark`/`rehype`):
  - `markdown.js` — `renderMarkdown()`, the unified processor entry point.
  - `remark-sidenotes.js` — custom remark plugin implementing the sidenote/margin-note
    transforms.
- `public/static/` — Tufte CSS assets (fonts, CSS, JS), served as `/static/`.
- `astro.config.mjs` — main config; also defines the `contentImagesPlugin` Vite plugin
  that serves/copies `content/img/` under `/static/img/`.
- `scripts/` — build and deploy helpers (see below).
- `dist/` — generated build output. **Do not edit by hand or commit.**

## Markdown Pipeline (`src/lib/`)

`renderMarkdown(markdown)` runs a `unified` chain: `remark-parse` → `remark-gfm` →
`remark-math` → `remarkSidenotes` → `remark-rehype` (`allowDangerousHtml`) →
`rehype-raw` → `rehype-katex` → `rehype-stringify`.

`remarkSidenotes` is given two helper renderers (`renderInline`, `renderBlocks`) so it
can turn note content into HTML before rehype runs. It handles:

- **Inline sidenotes**: `Main text^[This becomes a sidenote]` → numbered `.sidenote`.
- **Footnotes as sidenotes**: `Main text[^id]` + `[^id]: note text` → the definition is
  captured, removed from the flow, and rendered in the margin at the reference site.
- **Image-title margin notes**: `![Alt](path "Caption")` → `<figure><img></figure>` plus
  a `.marginnote` built from the title.
- **Inline `{:.marginnote}`**: an emphasis (`*text*{:.marginnote}`) or link
  (`[text](url){:.marginnote}`) immediately followed by `{:.marginnote}` becomes a
  toggleable `.marginnote`.

Math is KaTeX: inline `$E = mc^2$`, block `$$ ... $$`. Raw HTML in Markdown is allowed
(`rehype-raw`), which is what enables the Tufte layout classes (`.fullwidth`,
`.image-quilt`, `.newthought`, `<label class="margin-toggle">…`, etc.) documented in
`README.md` / `content/md2tufte.md`.

## Build, Dev, and Deploy

```bash
npm install        # install dependencies
npm run dev        # Astro dev server with hot reload
npm run build      # build-css.js (min CSS) + astro build → dist/
npm run preview    # serve the built site on port 1213
```

- **CSS**: `scripts/build-css.js` minifies `public/static/css/styles.dev.css` →
  `styles.min.css` (preserving `/*! ... */` license comments). Edit the `.dev.css`
  source, never the `.min.css` output. In dev, `BaseLayout` links `styles.dev.css`; in
  prod it links `styles.min.css?v=<8-char content hash>` for cache busting.
- **Content images**: `astro.config.mjs`'s `contentImagesPlugin` serves `/static/img/*`
  from `content/img/` during dev and copies the folder into `dist/static/img/` at build.
- **Astro assets**: emitted to `dist/static/_astro`.

Deploy helpers (both build first):

```bash
./scripts/manage.sh dev                       # wrapper for npm run dev
./scripts/manage.sh deploy                     # build + setup-nginx + clear cache + reload + rsync to remote
./scripts/manage.sh deploy --skip-remote       # local-only
./scripts/server.sh deploy                     # build + clear cache + rsync dist/ → /var/www/md2html
./scripts/setup-nginx.sh --port 1213           # write Nginx conf + serve dist/ on 127.0.0.1:1213
./scripts/setup-nginx.sh --port 1213 --server-name cruz.rio.br
```

- `manage.sh deploy` syncs the whole tree to the remote `server@192.168.18.50:/home/server/md2html`.
- The root `rsync.sh` does a similar `~/md2html/ → remote` sync.
- For Cloudflared, point the tunnel at `http://127.0.0.1:1213`; `preview` allows the
  `cruz.rio.br` hosts.

Run `npm run build` before publishing to validate the static output.

## Coding Style & Conventions

- ESM modules (`"type": "module"`); use `import`/`export`.
- Two-space indentation, double quotes, semicolons — match existing `src/` files.
- `camelCase` for variables/functions; `PascalCase` for Astro components
  (e.g. `BaseLayout.astro`).
- Keep content edits inside `content/` unless you are deliberately changing the
  rendering pipeline or layout.
- Do not add external runtime dependencies beyond `package.json` (no Python or
  system-level runtime scripts in the render path).
- Keep all project documentation and code in technical English; only `content/`
  Markdown may be non-English.

## Quality, Hygiene, and Security

- Keep code clean, readable, and minimal; remove obsolete or redundant content.
- Do not commit generated artifacts (`dist/`), backups, logs, or temp files.
- Avoid `TODO`/`FIXME`/`HACK` markers and commented-out code; keep only essential
  comments.
- Log output should be concise and must not expose sensitive information.
- Preserve accessible HTML: keep the landmark structure and the skip link in
  `BaseLayout.astro`, and keep meaningful `alt` text on images.
- Keep `CLAUDE.md` and `README.md` current when behavior changes. `AGENTS.md` is a
  symlink to this file, so updating `CLAUDE.md` updates both.

## Testing

- There is **no** automated test suite.
- Validate changes with `npm run dev` (local review) and `npm run build` (production-like
  check). If you add tests later, document the command here and keep test files near
  their modules.

## Commits & Pull Requests

- Keep commits concise and descriptive (git history uses short, single-line messages).
- PRs should summarize the change, mention affected paths (e.g. `src/lib/markdown.js`),
  and link related issues.
- Include screenshots for layout or CSS changes, especially when touching
  `public/static/` or `src/layouts/`.
