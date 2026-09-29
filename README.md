# md2tufte

A static site built with [Astro](https://astro.build) and
[Tufte CSS](https://edwardtufte.github.io/tufte-css/). Write Markdown in `content/`,
set the site's details in `config.ini`, and the site renders itself — sidenotes,
margin notes, math and all. Nothing else needs editing.

The published example lives at [cruz.rio.br/md2tufte](https://cruz.rio.br/md2tufte),
whose source is [`content/md2tufte.md`](content/md2tufte.md) — the full syntax guide.

## Quick Start

```bash
npm install
npm run dev      # hot-reloading dev server
npm run build    # minified CSS + static build into dist/
npm run preview  # serve the built site
npm run assets   # regenerate the social card (on demand, needs sharp)
```

Write in `content/`. `content/index.md` is the home page; every other
`content/*.md` becomes `/{filename}`. Images go in `content/img/` and are
referenced as `/static/img/...`.

## config.ini

Every site-wide setting lives here. Nothing in `src/` needs to be touched to
publish a different site. A fresh checkout starts by copying `config.example.ini`
to `config.ini`.

```ini
[site]
url = https://cruz.rio.br     ; origin for canonical URLs, sitemap and Open Graph
name = Bruno Cruz             ; site name, and the "— name" suffix in titles
short_name = bccc             ; install name in the web app manifest
language = en-US              ; <html lang>; og:locale becomes en_US
description = ...             ; fallback description for pages that derive none
keywords = one, two, three
theme_light = #ffffff         ; browser UI colour; match --background in the CSS
theme_dark = #1c1c1c
card_source = content/img/imga.png   ; artwork `npm run assets` builds the card from
card_alt = ...                       ; alt text for the social card

[author]
name = Bruno Cruz
role = Doctoral researcher in Social Anthropology
affiliation = ...
links = https://github.com/bzuer, https://orcid.org/...   ; schema.org sameAs

[server]
port = 12121                                  ; port Nginx serves dist/ on
nginx_conf = /etc/nginx/conf.d/md2bruno.conf  ; defaults to the project's directory name

[search]
indexnow_key = b3ac...    ; published at /<key>.txt; empty disables submission

[verification]
google-site-verification =   ; each key becomes a <meta name> when given a value
msvalidate.01 =
```

Everything else is derived: the icon set and its sizes are read from the files in
`public/static/icons/`, the social card's dimensions from the PNG itself, the
Nginx `server_name` and the preview's allowed hosts from `[site] url`.

Cloudflare credentials are the one thing kept out of `config.ini`, since they are
secret: `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`, in the environment or in
a git-ignored `.env.deploy`. Without them the cache purge is skipped with a
message and the deploy still succeeds.

## Publishing

```bash
./scripts/manage.sh deploy    # build, Nginx, verify, publish, status, verify again
./scripts/manage.sh status    # report on the build, Nginx, the port and both origins
./scripts/manage.sh verify    # check a running origin over HTTP
./scripts/manage.sh publish   # purge the Cloudflare cache, submit to IndexNow
./scripts/manage.sh nginx     # install the generated config and reload
./scripts/manage.sh nginx --print   # render it to stdout, change nothing
./scripts/manage.sh uninstall # remove the Nginx config, the build and node_modules
```

`deploy` installs the dependencies when they are missing or stale, builds,
updates the Nginx config if it differs from the generated one, checks the local
origin, purges the edge, notifies the search engines, reports the status and
checks the public site — in that order, so nothing is published on top of an
origin that is answering wrongly. Add `--no-publish` or `--no-verify` to skip a
stage. It asks for `sudo` only when something under `/etc` has to change.

`status` changes nothing. Among its checks, it compares the public site with the
local origin, so a tunnel pointed at the wrong port — or at another machine —
shows up as a failure rather than as a site that quietly stopped updating.

Nginx serves `dist/` on `127.0.0.1:<port>`, and nothing else of the site is
reachable; point a Cloudflared tunnel at that address (`127.0.0.1`, not
`localhost`). The scripts follow the same rules as the other services on the
server — see `CLAUDE.md`.

### Several sites on one server

Each checkout is self-contained: give it its own directory, its own `[site] url`
and its own `[server] port`, and nothing else needs saying. `nginx_conf` defaults
to the project's directory name (`~/md2lfdd` → `/etc/nginx/conf.d/md2lfdd.conf`),
so two sites never write to the same file, and the cache `map` variable is named
after that file, so they never collide inside Nginx either.

Two guards protect the sites that are already running: `manage.sh nginx` refuses
to install if another config on the server already listens on the chosen port —
duplicate `default_server` blocks on one address stop Nginx from loading *at
all* — and if `nginx -t` rejects a generated config it is rolled back instead of
being left on disk, where it would break the next reload of every other site.

The dev server is the one shared default: `npm run dev` starts on Astro's port
4321 and steps to the next free one when a sibling site already holds it.

Each checkout carries its own dependencies; `manage.sh` installs them from the
lockfile when they are missing, so a new checkout needs no separate step.

## Metadata

Pages describe themselves. Titles come from the first `#` heading, descriptions
from the first prose paragraph, so a new Markdown file gets a complete `<head>` —
canonical URL, Open Graph, Twitter card, JSON-LD — with no extra authoring.
`robots.txt`, `sitemap.xml`, `site.webmanifest`, `/favicon.ico` and the IndexNow
key file are generated from the same values at build time.

Add frontmatter only to override:

```yaml
---
title: "The md2tufte Possibilities: a Practical Guide"
description: A practical guide to the md2tufte Markdown syntax.
keywords: [md2tufte, Tufte CSS, Markdown]
image: /static/img/custom-card.png
imageAlt: What the card shows.
date: 2026-01-31
noindex: false
---
```

Canonical URLs carry **no trailing slash** (`/md2tufte`). Nginx redirects
`/md2tufte/`, `/md2tufte.html`, `/index.html` and the `www` host onto that form,
and returns a real 404 for unknown addresses. The generated config also sets the
security headers — including a `default-src 'none'` Content-Security-Policy, which
the site can afford because it ships no client-side JavaScript.

## Markdown Support

- Sidenotes: `Main text^[This becomes a sidenote]`
- Footnotes: `Main text[^note]` + `[^note]: note text` (rendered as sidenotes)
- Captioned images: `![Alt](path "Caption")` — the caption goes in the margin
- Margin notes via `{:.marginnote}` on inline emphasis or links
- Math with KaTeX: inline `$E = mc^2$`, block `$$ a^2 + b^2 = c^2 $$`
- GitHub-flavoured Markdown: tables, task lists, strikethrough
- Raw HTML, which is what makes the Tufte classes available: `.fullwidth`,
  `.marginnote`, `.newthought`, `.image-quilt`

The complete guide, with rendered examples, is
[`content/md2tufte.md`](content/md2tufte.md).

## Accessibility

Pages follow the reader's light or dark setting, reflow down to a 320px screen
(400% zoom) without sideways scrolling, and can be read with a keyboard or a
screen reader, with no JavaScript. The build adds what that takes, so the author
writes none of it: wide tables and code scroll in their own focusable box, margin
toggles are reachable and named ("Sidenote 2", "Margin note"), task-list boxes
are labelled, and an empty header row makes a headerless table. What the author
still owes is alt text, headings in order and link text that names its
destination. The guide's "Reading Modes and Accessibility" section shows each.

## Contact Details

Write an address the way you would say it — `[Mail](mailto:you@example.com)`, or
just `you@example.com` in a sentence — and the build publishes it obfuscated. The
link's address is percent-encoded, so it is not a string a harvester can grep, and
an address shown in the text is broken by a hidden decoy, so a scraper reading the
page collects a mailbox that cannot receive mail. The link still works, the address
still copies, and a screen reader still reads the real one. Nothing to remember,
and no JavaScript.

It stops harvesters that read HTML, which is what crawls a site this size; it does
not stop one driving a real browser. Addresses are also kept out of the `<head>`
and the JSON-LD, where obfuscation would be pointless — every reader of a meta tag
decodes it. `./scripts/manage.sh verify` fails if a clear-text address ever reaches
a published page.

## Project Structure

```
config.ini            Every site-wide setting (git-ignored)
config.example.ini    The template a new checkout copies to config.ini
content/              Markdown source and content/img/ artwork
docs/                 Reference material, not part of the build
public/static/        Tufte CSS, fonts, icons and the generated social card
src/lib/              Config, Markdown pipeline and metadata
src/pages/            Routes and generated endpoints
src/layouts/          BaseLayout.astro — the HTML shell
src/components/       SiteHead.astro — the whole <head>
scripts/              Build, Nginx, publish and verify helpers
dist/                 Build output (git-ignored)
```

## License

[MIT](LICENSE).
