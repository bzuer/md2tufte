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
  - Any other `content/*.md` maps to `/{filename}` via `src/pages/[slug].astro`
    (e.g. `content/md2tufte.md` → `/md2tufte`).
  - `content/img/` — image assets, referenced in Markdown as `/static/img/...`.
- `src/pages/` — Astro routes. Besides the pages themselves, `404.astro`,
  `robots.txt.js`, `sitemap.xml.js`, `site.webmanifest.js`, `favicon.ico.js` and
  `[indexNowKey].txt.js` are **generated endpoints**, so nothing they emit can drift
  from `src/lib/site.js` (see “Metadata and SEO”).
- `src/layouts/BaseLayout.astro` — shared HTML shell (KaTeX CSS, skip link, landmark
  structure, deferred `main.min.js`); delegates the whole `<head>` to `SiteHead`.
- `src/components/SiteHead.astro` — every `<head>` tag: title, description, keywords,
  canonical, icons, Open Graph, Twitter and the JSON-LD block.
- `src/lib/` — rendering pipeline and metadata:
  - `markdown.js` — `renderMarkdown()`, the unified processor entry point.
  - `remark-sidenotes.js` — custom remark plugin implementing the sidenote/margin-note
    transforms.
  - `site.js` — single source of truth for site-wide metadata; `absoluteUrl()`.
  - `content.js` — the only place mapping `content/*.md` to routes.
  - `frontmatter.js` — optional YAML-subset frontmatter parser (no dependencies).
  - `metadata.js` — frontmatter overrides layered over values derived from the Markdown.
  - `structured-data.js` — the schema.org graph.
  - `stylesheet.js` — dev/minified stylesheet URL with the content hash.
- `public/static/` — Tufte CSS assets (fonts, CSS, JS), served as `/static/`, plus the
  authored `icons/` set and the generated `og/` card.
- `astro.config.mjs` — main config; also defines the `contentImagesPlugin` Vite plugin
  that serves/copies `content/img/` under `/static/img/`.
- `scripts/` — build and deploy helpers (see below).
- `dist/` — generated build output. Git-ignored; **do not edit by hand or commit.**

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

## Metadata and SEO

Every site-wide value — origin, author, keywords, locale, social card — lives in
`src/lib/site.js`. Nothing that reaches a `<head>`, `robots.txt` or the sitemap is
written down twice; `astro.config.mjs` imports `site.url` for the `site` option.

Content files need **no** frontmatter: `src/lib/metadata.js` derives the title from the
first `#` heading and the description from the first prose paragraph (skipping HTML
blocks, headings, code and the sidenote syntax), truncated to 160 characters on a word
boundary. Optional frontmatter overrides any of it — `title`, `description`,
`keywords`, `image`, `imageAlt`, `date`, `noindex` — parsed by `src/lib/frontmatter.js`,
a small YAML subset (scalars, quoted scalars, booleans, inline and block lists). A file
without a frontmatter block, or with an unterminated one, is treated as pure Markdown.

**Canonical URL form is without a trailing slash** (`/md2tufte`). This is enforced in
three places that must stay consistent: `trailingSlash: "never"` and
`build.format: "file"` in `astro.config.mjs` (Astro emits `md2tufte.html`), the
`<link rel="canonical">` from `site.js`, and the Nginx redirects. `/md2tufte/`,
`/md2tufte.html` and `/index.html` all 301 to the canonical form, and `www` folds onto
the apex host.

`robots.txt` and `sitemap.xml` are **generated routes**, not files in `public/`, so the
sitemap URL and the `<loc>` origin cannot drift from `site.js`. The sitemap reads the
same `listContentPages()` the `[slug]` route uses, so a new Markdown file becomes a
route and a sitemap entry in one build; `<lastmod>` comes from file mtime, and a page
with `noindex: true` is excluded.

Unknown URLs must return a real **404** (`src/pages/404.astro`), never the home page —
see the Nginx notes below.

Icons in `public/static/icons/` are **authored artwork**, not generated: `favicon.ico`,
`favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` and the two
`android-chrome-*.png` install icons. `site.icons` lists them and every reference reads
that list — the `<head>` links, `/site.webmanifest`, and `/favicon.ico`, which is served
from the same file rather than a second copy at the site root (crawlers, feed readers
and chat unfurlers probe that path whatever `<head>` declares). `scripts/build-og.js`
must never write into this directory.

The social card is the one generated asset, rebuilt on demand:

```bash
npm run assets     # node scripts/build-og.js
```

It rebuilds `public/static/og/og-default.png` (1200×630, trimmed and centred from
`content/img/imga.png`). It is deliberately **not** part of `npm run build`: that keeps
`sharp` a devDependency and out of the render path.

**Search engines are notified by the deploy, not by hand.** `scripts/publish.js` submits
the sitemap's URLs to IndexNow, which fans out to Bing, Yandex, Seznam and Naver; the
key it proves ownership with is `site.search.indexNowKey`, published at `/<key>.txt` and
public by design. Google takes no part in IndexNow and needs no ping — the endpoint it
once offered was retired in 2023, so it discovers changes from the `Sitemap:` line in
`robots.txt` and each `<lastmod>` in the sitemap. Submitting the sitemap once in Google
Search Console is the only step that stays manual; `site.search.verification` holds the
console ownership tokens, keyed by the exact `<meta name>` each console requires, for
the case where verifying by DNS TXT record is not an option.

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
  from `content/img/` during dev and copies it into `dist/static/img/` at build.
  Only image files are served/copied — non-image sources in `content/img/` (e.g.
  `image-maker.py`) are never published.
- **Astro assets**: emitted to `dist/static/_astro`.

Deploy is local only (Nginx serves `dist/` directly; expose it via Cloudflared):

```bash
./scripts/manage.sh dev                           # wrapper for npm run dev
./scripts/manage.sh deploy                        # the full pipeline, below
./scripts/manage.sh publish                       # purge the edge, notify IndexNow
./scripts/manage.sh verify                        # check the public origin over HTTP
./scripts/setup-nginx.sh --port 1213              # write Nginx conf + serve dist/ on 127.0.0.1:1213
./scripts/setup-nginx.sh --port 1213 --server-name cruz.rio.br
./scripts/setup-nginx.sh --print-config           # render the conf to stdout, change nothing
```

`deploy` runs, in order: `npm run build` → `setup-nginx.sh` → clear the local Nginx
cache → reload → **verify the origin** at `127.0.0.1:1213` → **publish** → **verify the
public site**. The origin is checked before anything is published on purpose: purging
the edge and inviting a crawl are worth nothing if the server behind them is answering
wrongly. `--no-publish` and `--no-verify` skip those stages.

- `scripts/publish.js` purges the whole Cloudflare zone — unhashed assets (images,
  icons, the card) keep their URL when their bytes change, so a targeted purge would
  have to know what changed — and then submits to IndexNow. It reads
  `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` from the environment or from
  `.env.deploy` (git-ignored by the existing `.env.*` rule) and never prints them.
  Absent credentials **skip** the purge with an explanation instead of failing the
  deploy; credentials that are present and then error do fail it.
- `scripts/verify.js` asserts over HTTP what a build can only imply: canonical tag,
  description, `og:image`, Twitter card and JSON-LD on the home page; all four 301
  forms; a real 404 on an unknown URL; `robots.txt`, `sitemap.xml`, the manifest, every
  icon, the social card and the IndexNow key file; and the security and cache headers.
  `--origin <url>` points it at any origin, which is how `deploy` checks the local
  server and the public site with the same code.

For Cloudflared, point the tunnel at `http://127.0.0.1:1213`; `preview` allows the
`cruz.rio.br` hosts.

The generated Nginx config is part of the site's correctness, not just its plumbing:

- `try_files $uri $uri.html =404` — an unknown URL must **not** fall back to
  `/index.html`. The old fallback answered 200 with the home page for every address,
  which search engines read as an infinite set of real pages.
- 301s fold `/page/`, `/page.html`, `/index.html` and the `www` host onto the canonical
  form. `absolute_redirect off` keeps `Location` path-relative so redirects survive TLS
  terminating upstream at Cloudflare.
- Cache lifetimes come from a `map` keyed on `$uri`, so the server block carries a
  single `add_header` — an `add_header` inside a `location` would silently drop the
  inherited security headers.
- HSTS and any CSP are Cloudflare's responsibility; the origin sets
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`.
- This Nginx build ships no `.webmanifest` entry in `mime.types`, so
  `location = /site.webmanifest` sets `default_type`. That block declares no
  `add_header` for the reason above.

The first `--server-name` is the canonical host and the one `www.` redirects to.

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

- There is **no** unit-test suite.
- `scripts/verify.js` is the standing check: it asserts the routing and metadata
  contract over HTTP against a running origin, and `./scripts/manage.sh deploy` runs it
  on both the origin and the public site. Run it alone with `./scripts/manage.sh verify`
  or `node scripts/verify.js --origin http://127.0.0.1:1213`.
- Otherwise validate with `npm run dev` (local review) and `npm run build`
  (production-like check). If you add unit tests later, document the command here and
  keep test files near their modules.

## Commits & Pull Requests

- Keep commits concise and descriptive (git history uses short, single-line messages).
- PRs should summarize the change, mention affected paths (e.g. `src/lib/markdown.js`),
  and link related issues.
- Include screenshots for layout or CSS changes, especially when touching
  `public/static/` or `src/layouts/`.
