# Repository Guidelines

## Project Purpose & Author Workflow

- The core goal is technological invisibility: the author writes in `content/index.md` and the system renders it without extra steps.
- Preserve the existing Markdown syntax exactly, including sidenotes (`^[note]`) and footnotes (`[^note]`) that render as margin notes.
- Keep the workflow simple: one command opens the site with hot reload, and publishing should be triggered by commit/push, not manual deploy steps.

## Project Structure & Module Organization

- `content/` holds the Markdown source; `content/index.md` is the entry point read directly by `src/pages/index.astro`.
- `content/img/` holds image assets served from `/static/img/`.
- Additional Markdown files map automatically to routes (e.g., `content/works.md` -> `/works`) via `src/pages/[slug]/index.astro`.
- `public/static/` contains Tufte CSS assets (fonts, CSS, JS) served as `/static/`.
- `src/pages/` defines routes, `src/layouts/` contains shared Astro layouts, and `src/lib/` houses the Markdown pipeline (`remark`/`rehype`) helpers.
- `astro.config.mjs` is the main project configuration.
- Built Astro assets are emitted to `dist/static/_astro`.
- Math is rendered with KaTeX (see `BaseLayout.astro` and `src/lib/markdown.js`).
- `dist/` is generated output from builds; do not edit by hand or commit.
- Production CSS URLs include a content hash for cache busting, based on `public/static/css/styles.min.css`.

## Build, Test, and Development Commands

```bash
npm install        # install dependencies
npm run dev        # run Astro dev server with hot reload
npm run build      # build static site to dist/
npm run preview    # serve the built site (local preview)
./scripts/manage.sh dev  # optional wrapper for npm run dev
./scripts/manage.sh deploy  # build + sync + nginx (default)
./scripts/setup-nginx.sh --port 1213  # nginx setup
```

If the site is accessed via a custom host, use:

```bash
./scripts/setup-nginx.sh --port 1213 --server-name cruz.rio.br
```

Use `npm run build` before publishing to validate the static output.

## Coding Style & Naming Conventions

- JavaScript modules are ESM (`"type": "module"`); use `import`/`export`.
- Use two-space indentation, double quotes, and semicolons, matching existing files in `src/`.
- Prefer `camelCase` for variables/functions, and `PascalCase` for Astro components (e.g., `BaseLayout.astro`).
- Keep content edits confined to `content/` unless changing the rendering pipeline or layout.
- Do not introduce external runtime dependencies beyond `package.json` (no Python or system-level scripts).
- Keep all project documentation and code in technical English; only `content/` Markdown may be non-English.

## Quality, Hygiene, and Security Expectations

- Keep code clean, readable, and minimal; remove obsolete or redundant content.
- Do not commit generated artifacts, backups, logs, or temporary files.
- Avoid TODO/FIXME/HACK markers and commented-out code; keep only essential comments.
- Log output should be concise and avoid exposing sensitive information.
- Keep `README.md` and `AGENTS.md` current when behavior changes.
- Preserve accessible HTML output by keeping landmark structure and the skip link in `src/layouts/BaseLayout.astro`.

## Testing Guidelines

- There is no automated test suite in this repository.
- Validate changes by running `npm run dev` for local review and `npm run build` for a production-like check.
- If you add tests later, document the command in this section and keep test files near their related modules.

## Commit & Pull Request Guidelines

- Git history is minimal and uses short, single-line descriptions (e.g., “Argo-project”); keep commits concise and descriptive.
- PRs should include a clear summary, mention affected paths (e.g., `src/lib/markdown.js`), and link any related issues.
- Include screenshots for layout or CSS changes, especially when modifying `public/static/` or `src/layouts/`.
