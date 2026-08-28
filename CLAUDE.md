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

**Two files are the whole configuration surface: `content/` and `config.ini`.** A
change that forces the author to edit anything in `src/`, `scripts/` or
`astro.config.mjs` to publish is a regression. Every other value is derived — from
`config.ini`, from the Markdown itself, or from files already on disk.

> Heads-up on naming: the repo, the package and the public URL are all `md2tufte`, but
> the installed Nginx config is still `/etc/nginx/conf.d/md2html.conf`. That path is
> the one piece of legacy naming left, and it is spelled out once, in
> `config.ini` (`[server] nginx_conf`). Renaming it means installing the new file and
> removing the old one by hand — two configs listening on the same port will not load.

## Project Structure

- `config.ini` — every site-wide setting (see “Configuration”).
- `content/` — Markdown source (the author's writing; keep edits confined here unless
  changing the pipeline or layout).
  - `content/index.md` — home page, read directly by `src/pages/index.astro`.
  - Any other `content/*.md` maps to `/{filename}` via `src/pages/[slug].astro`
    (e.g. `content/md2tufte.md` → `/md2tufte`).
  - `content/img/` — image assets, referenced in Markdown as `/static/img/...`.
- `docs/` — reference material, never built or published: `tufte.css` (the upstream
  Tufte CSS this site's stylesheet descends from) and `image-maker.py` (the script the
  author generated the artwork with).
- `src/pages/` — Astro routes. Besides the pages themselves, `404.astro`,
  `robots.txt.js`, `sitemap.xml.js`, `site.webmanifest.js`, `favicon.ico.js` and
  `[indexNowKey].txt.js` are **generated endpoints**, so nothing they emit can drift
  from `config.ini`.
- `src/layouts/BaseLayout.astro` — shared HTML shell (KaTeX CSS, skip link, landmark
  structure); delegates the whole `<head>` to `SiteHead`.
- `src/components/SiteHead.astro` — every `<head>` tag: title, description, keywords,
  canonical, icons, Open Graph, Twitter and the JSON-LD block.
- `src/lib/` — configuration, rendering pipeline and metadata:
  - `paths.js` — the project's directories, all resolved from the working directory.
  - `config.js` — parses `config.ini` and exports `site`, `absoluteUrl()`,
    `documentTitle()`. The single source of site-wide metadata.
  - `assets.js` — facts read off files instead of configured: image dimensions, the
    icon set, the content-hashed stylesheet URL.
  - `markdown.js` — `renderMarkdown()`, the unified processor entry point.
  - `remark-sidenotes.js` — custom remark plugin implementing the sidenote/margin-note
    transforms.
  - `rehype-contacts.js` — obfuscates email addresses and telephone links against
    harvesting.
  - `content-images.js` — Vite plugin serving/copying `content/img/` as `/static/img/`.
  - `content.js` — the only place mapping `content/*.md` to routes.
  - `frontmatter.js` — optional YAML-subset frontmatter parser (no dependencies).
  - `metadata.js` — frontmatter overrides layered over values derived from the Markdown.
  - `structured-data.js` — the schema.org graph.
- `public/static/` — Tufte CSS assets (fonts, CSS), served as `/static/`, plus the
  authored `icons/` set and the generated `og/` card.
- `astro.config.mjs` — Astro options only; everything variable comes from `config.js`.
- `scripts/` — build, Nginx, publish and verify helpers (see below).
- `dist/` — generated build output. Git-ignored; **do not edit by hand or commit.**

## Configuration (`config.ini`)

One INI file, five sections, no comments to maintain:

- `[site]` — `url`, `name`, `short_name`, `language`, `description`, `keywords`,
  `theme_light`, `theme_dark`, `card_source`, `card_alt`.
- `[author]` — `name`, `role`, `affiliation`, `links` (comma-separated, becomes
  schema.org `sameAs`).
- `[server]` — `port`, and `nginx_conf` when the generated config should not go to
  `/etc/nginx/conf.d/<project directory>.conf`.
- `[search]` — `indexnow_key`; empty stops publishing the key file and skips submission.
- `[verification]` — one key per webmaster console, named exactly as the `<meta name>`
  it requires. An empty value emits no tag.

Anything that can be derived is **not** in the file, and must not be added to it:

- `server_name` and the `www` redirect, the preview's `allowedHosts`, IndexNow's
  `host` and `keyLocation`, and every absolute URL come from `[site] url`.
- `language` gives both `<html lang>` and `og:locale` (`en-US` → `en_US`); a tag
  without a region emits no `og:locale`.
- The icon set is whatever `public/static/icons/` holds, classified by filename —
  `favicon.ico`, `favicon-*.png`, `apple-touch-icon.png`, `android-chrome-*.png` — with
  the sizes read out of the PNG and ICO headers. Adding a file is the whole change.
- The social card's dimensions are read from the PNG; only its alt text and the source
  artwork are configured.
- Nginx's `root` and the sitemap path come from `paths.js`.

Cloudflare credentials stay out of `config.ini` because they are secret:
`CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`, in the environment or in a
git-ignored `.env.deploy`.

## Markdown Pipeline (`src/lib/`)

`renderMarkdown(markdown)` runs a `unified` chain: `remark-parse` → `remark-gfm` →
`remark-math` → `remarkSidenotes` → `remark-rehype` (`allowDangerousHtml`) →
`rehype-raw` → `rehype-katex` → `rehypeContacts` → `rehype-stringify`.

`remarkSidenotes` is given two helper renderers (`renderInline`, `renderBlocks`) so it
can turn note content into HTML before rehype runs. It handles:

- **Inline sidenotes**: `Main text^[This becomes a sidenote]` → numbered `.sidenote`.
  The note is collected across sibling nodes, not inside one, because remark has
  already split the paragraph at every link, emphasis, code span or autolinked
  address in it — so `^[a note with *emphasis*]` is a note, not literal text.
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
`README.md` / `content/md2tufte.md`. Note that Markdown inside a block-level HTML
element is *not* parsed — write links there as `<a href>`, not `[text](url)`.

`rehypeContacts` runs last, after `rehype-raw`, so it sees the anchors the author
wrote as raw HTML and the notes `remarkSidenotes` rendered to HTML strings as real
elements. **Contact details are written plainly in Markdown and published
obfuscated** — the author never encodes an address by hand:

- a `mailto:` or `tel:` href is percent-encoded (`mailto:%63%75%6e…`), so the
  address is not a literal string in the markup a harvester greps. Only the address
  is encoded; a `?subject=` query keeps its separators, or it would fold into the
  mailbox name. An href that already carries `%XX` escapes is left alone.
- an address written into the visible text is split around a `<span hidden>` decoy,
  so a scraper reading the DOM text harvests a mailbox that cannot receive mail —
  the decoy leaves a dot against the `@`. A reader sees, copies and hears the real
  one: `display:none` content is in neither the selection nor the accessibility
  tree. `remark-gfm` autolinks a bare address first, so both halves apply to it.

This defeats harvesters that read HTML, which is what crawls a site this size. It
does not defeat one driving a real browser engine, and without JavaScript nothing
can. `scripts/verify.js` asserts over HTTP that no clear-text address survives to a
published page, which is what keeps the property from quietly regressing.

The site ships no client-side JavaScript: the margin-note toggles are CSS checkboxes.
Do not reintroduce a script tag without a reason a reader would feel.

## Metadata and SEO

Content files need **no** frontmatter: `src/lib/metadata.js` derives the title from the
first `#` heading and the description from the first prose paragraph (skipping HTML
blocks, headings, code and the sidenote syntax), truncated to 160 characters on a word
boundary. Optional frontmatter overrides any of it — `title`, `description`,
`keywords`, `image`, `imageAlt`, `date`, `noindex` — parsed by `src/lib/frontmatter.js`,
a small YAML subset (scalars, quoted scalars, booleans, inline and block lists). A file
without a frontmatter block, or with an unterminated one, is treated as pure Markdown.

An email address is stripped from a *derived* title or description along with the
other syntax that must not leak into a meta tag. A meta tag cannot be obfuscated —
every reader of one decodes it — so the address is dropped rather than published
there in clear text. The JSON-LD graph carries no `email` or `telephone` node for
the same reason.

**Canonical URL form is without a trailing slash** (`/md2tufte`). This is enforced in
three places that must stay consistent: `trailingSlash: "never"` and
`build.format: "file"` in `astro.config.mjs` (Astro emits `md2tufte.html`), the
`<link rel="canonical">` built from `[site] url`, and the Nginx redirects.
`/md2tufte/`, `/md2tufte.html` and `/index.html` all 301 to the canonical form, and
`www` folds onto the apex host.

`robots.txt` and `sitemap.xml` are **generated routes**, not files in `public/`, so the
sitemap URL and the `<loc>` origin cannot drift. The sitemap reads the same
`listContentPages()` the `[slug]` route uses, so a new Markdown file becomes a route
and a sitemap entry in one build; `<lastmod>` comes from file mtime, and a page with
`noindex: true` is excluded.

Unknown URLs must return a real **404** (`src/pages/404.astro`), never the home page —
see the Nginx notes below.

Icons in `public/static/icons/` are **authored artwork**, not generated. They are not
listed anywhere: `src/lib/assets.js` reads the directory and the image headers, and the
`<head>` links, `/site.webmanifest`, `/favicon.ico` and `scripts/verify.js` all consume
that one derived set. `/favicon.ico` is served from the same file rather than a second
copy at the site root (crawlers, feed readers and chat unfurlers probe that path
whatever `<head>` declares). `scripts/build-og.js` must never write into this directory.

The social card is the one generated asset, rebuilt on demand:

```bash
npm run assets     # node scripts/build-og.js
```

It rebuilds `public/static/og/og-default.png` (1200×630, trimmed and centred from
`[site] card_source`). It is deliberately **not** part of `npm run build`: that keeps
`sharp` a devDependency and out of the render path.

**Search engines are notified by the deploy, not by hand.** `scripts/publish.js` submits
the sitemap's URLs to IndexNow, which fans out to Bing, Yandex, Seznam and Naver; the
key it proves ownership with is `[search] indexnow_key`, published at `/<key>.txt` and
public by design. Google takes no part in IndexNow and needs no ping — the endpoint it
once offered was retired in 2023, so it discovers changes from the `Sitemap:` line in
`robots.txt` and each `<lastmod>` in the sitemap. Submitting the sitemap once in Google
Search Console is the only step that stays manual; `[verification]` holds the console
ownership tokens for the case where verifying by DNS TXT record is not an option.

## Build, Dev, and Deploy

```bash
npm install        # install dependencies
npm run dev        # Astro dev server with hot reload
npm run build      # build-css.js (min CSS) + astro build → dist/
npm run preview    # serve the built site on Astro's default port
npm run assets     # regenerate the social card
```

- **CSS**: `scripts/build-css.js` minifies `public/static/css/styles.dev.css` →
  `styles.min.css` (preserving `/*! ... */` license comments). Edit the `.dev.css`
  source, never the `.min.css` output. In dev, `BaseLayout` links `styles.dev.css`; in
  prod it links `styles.min.css?v=<8-char content hash>` for cache busting.
- **Content images**: `src/lib/content-images.js` serves `/static/img/*` from
  `content/img/` during dev and copies it into `dist/static/img/` at build. Only image
  files are served/copied, so anything else left beside the artwork stays unpublished.
- **Astro assets**: emitted to `dist/static/_astro`.
- **Preview** runs on Astro's default port, not `[server] port`: Nginx already holds
  that one. It accepts the configured host so the built site can also be previewed
  through the tunnel.

Deploy is local only (Nginx serves `dist/` directly; expose it via Cloudflared).
`scripts/manage.sh` is the single entry point, and takes no settings of its own — it
reads `config.ini` through `node scripts/config.js`:

```bash
./scripts/manage.sh dev
./scripts/manage.sh build
./scripts/manage.sh nginx            # install the generated config and reload
./scripts/manage.sh nginx --print    # render it to stdout, change nothing
./scripts/manage.sh deploy           # the full pipeline, below
./scripts/manage.sh publish          # purge the edge, notify IndexNow
./scripts/manage.sh verify           # check the public origin over HTTP
./scripts/manage.sh verify --origin http://127.0.0.1:1213
```

`deploy` runs, in order: `npm run build` → install the Nginx config and reload →
**verify the origin** at `127.0.0.1:<port>` → **publish** → **verify the public site**.
The origin is checked before anything is published on purpose: purging the edge and
inviting a crawl are worth nothing if the server behind them is answering wrongly.
`--no-publish` and `--no-verify` skip those stages.

The Nginx config is **regenerated and reinstalled on every deploy**, so the server can
never keep serving a stale copy — an earlier version of this project broke exactly that
way, answering 500 from a path that no longer existed after the repo was renamed.

- `scripts/nginx.js` renders the config from `config.ini` and prints it; it needs no
  root, so the output can be read before it is installed. `manage.sh nginx` installs it,
  grants the Nginx user traversal into the site root (ACLs, falling back to `chmod`),
  runs `nginx -t` and reloads.
- `scripts/publish.js` purges the whole Cloudflare zone — unhashed assets (images,
  icons, the card) keep their URL when their bytes change, so a targeted purge would
  have to know what changed — and then submits to IndexNow. Absent credentials **skip**
  the purge with an explanation instead of failing the deploy; credentials that are
  present and then error do fail it. They are never printed.
- `scripts/verify.js` asserts over HTTP what a build can only imply: canonical tag,
  description, `og:image`, Twitter card and JSON-LD on the home page; the 301 forms; a
  real 404 on an unknown URL; `robots.txt`, `sitemap.xml`, the manifest, every icon, the
  social card and the IndexNow key file; the security and cache headers, CSP included;
  and that **no clear-text contact address survives to a page** — an unencoded
  `mailto:`/`tel:` href, or an address written out in the markup, fails the run. It
  probes whichever page the author happens to have written — never a hardcoded slug —
  and `--origin <url>` points it at any origin, which is how `deploy` checks the local
  server and the public site with the same code.

For Cloudflared, point the tunnel at `http://127.0.0.1:<port>`.

### Several sites from this template on one server

One machine can serve any number of these sites — `md2tufte`, `md2lfdd`, … — each
its own checkout on its own port. Nothing may be shared but Nginx itself:

- `[server] port` is what separates them. `default_server` is scoped to an
  `address:port` pair, so one per port is correct; two on the *same* port stop Nginx
  from loading at all and take down every site on the box. `manage.sh nginx` therefore
  scans `conf.d/` and `sites-enabled/` and refuses to install onto a port another
  config already listens on.
- `nginx_conf` defaults to the project's directory name, so a second checkout never
  overwrites the first one's config, and the cache `map` variable is named after that
  file, so two configs never declare the same variable.
- A generated config that fails `nginx -t` is rolled back to the previous version (or
  removed, if there was none). Leaving a rejected config in `conf.d/` would break the
  next reload of every *other* site, not just this one.
- Nothing else touches shared state: no pm2 process, no shared cache directory, no
  fixed asset path outside the project. Keep it that way — a step that writes anywhere
  global belongs in `config.ini` as a per-site value, or nowhere.
- The dev server is the one shared default: Astro starts at port 4321 and steps to the
  next free one, so a second `npm run dev` does not fail, it just moves.
- Dependencies are per checkout: a new one needs `npm install` before it can build.
  `manage.sh` checks for `node_modules/.bin/astro` and says so, because npm's own
  error for a missing install (`astro: not found`) points nowhere.

The generated Nginx config is part of the site's correctness, not just its plumbing:

- `try_files $uri $uri.html =404` — an unknown URL must **not** fall back to
  `/index.html`. That fallback answers 200 with the home page for every address, which
  search engines read as an infinite set of real pages.
- 301s fold `/page/`, `/page.html`, `/index.html` and the `www` host onto the canonical
  form. `absolute_redirect off` keeps `Location` path-relative so redirects survive TLS
  terminating upstream at Cloudflare.
- A redirect must never be able to leave the site. `//host/page.html` is folded to
  `/host/page.html` by `merge_slashes`, but a **backslash** is not: browsers follow
  the WHATWG URL rules, where `\` counts as `/`, so a `Location` of `/\host/page`
  resolves to `https://host/page`. Both redirect patterns therefore exclude `\x5c`
  (written as a code point so it survives Nginx's own unescaping), and such a
  request falls through to the 404. Probe it before changing either pattern:
  `curl -sI --path-as-is "$ORIGIN/%5cevil.example/x.html"` must not answer 301.
- Cache lifetimes come from a `map` keyed on `$uri`, so the server block carries a
  single `add_header` — an `add_header` inside a `location` would silently drop the
  inherited security headers. The map variable is named after the config file to avoid
  colliding with another site on the same server.
- HSTS belongs to Cloudflare, which is what terminates TLS. Everything else is the
  origin's, because the origin is what knows the pages: `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and a
  **Content-Security-Policy** of `default-src 'none'` with `script-src 'none'` — the
  no-JavaScript rule above, made enforceable by the browser. A JSON-LD block is a
  data block, not a script, and is not covered by it. `style-src` must keep
  `'unsafe-inline'`: KaTeX sizes every glyph with a `style` attribute, and the
  author writes them in Markdown. `img-src` allows `https:` so a linked
  illustration still loads; an embed from another origin (an iframe, a web font,
  a script) is blocked and needs the policy widened first.
- `server_tokens off` keeps the version out of the `Server` header, and a dotfile
  in the site root — one copied out of `public/` by accident — answers 404 rather
  than being served. `/.well-known/` stays reachable.
- This Nginx build ships no `.webmanifest` entry in `mime.types`, so
  `location = /site.webmanifest` sets `default_type`. That block declares no
  `add_header` for the reason above.

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

- Before adding a setting anywhere, check whether it is already implied by something
  else. A value written twice is a value that will disagree with itself.
- Keep code clean, readable, and minimal; remove obsolete or redundant content.
- Do not commit generated artifacts (`dist/`), backups, logs, or temp files.
- Avoid `TODO`/`FIXME`/`HACK` markers and commented-out code; keep only essential
  comments — those that explain *why*, not *what*.
- Log output should be concise and must not expose sensitive information.
- `scripts/config.js` is `eval`'d by `manage.sh`, so it emits **shell**-quoted values.
  JSON quoting is not shell quoting: a `$`, a backtick or a backslash in `config.ini`
  survives it and runs as code. Anything else that crosses into the shell owes the
  same care.
- Preserve accessible HTML: keep the landmark structure and the skip link in
  `BaseLayout.astro`, and keep meaningful `alt` text on images.
- `README.md` documents the project for a reader; `content/md2tufte.md` is the syntax
  guide and the published example. Neither should copy the other.
- Keep `CLAUDE.md` and `README.md` current when behavior changes. `AGENTS.md` is a
  symlink to this file, so updating `CLAUDE.md` updates both.

## Testing

- There is **no** unit-test suite.
- `scripts/verify.js` is the standing check: it asserts the routing and metadata
  contract over HTTP against a running origin, and `./scripts/manage.sh deploy` runs it
  on both the origin and the public site. Run it alone with `./scripts/manage.sh verify`
  or `./scripts/manage.sh verify --origin http://127.0.0.1:1213`.
- To exercise the generated Nginx config without touching the installed one, render it
  with `./scripts/manage.sh nginx --print`, change the port, and run a throwaway
  `nginx -p <prefix> -c <conf>` instance to verify against. This is the only way to
  test the redirect and header rules, and the right place to re-probe the
  open-redirect vectors after touching either `location ~` pattern. Reload retires
  the old workers asynchronously — stop and start the instance, or a probe may still
  be answered by the config you just replaced.
- Otherwise validate with `npm run dev` (local review) and `npm run build`
  (production-like check). If you add unit tests later, document the command here and
  keep test files near their modules.

## Commits & Pull Requests

- Keep commits concise and descriptive (git history uses short, single-line messages).
- PRs should summarize the change, mention affected paths (e.g. `src/lib/markdown.js`),
  and link related issues.
- Include screenshots for layout or CSS changes, especially when touching
  `public/static/` or `src/layouts/`.
