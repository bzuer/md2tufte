// config.ini is the only place site-wide settings are written. Everything else
// here is derived from it, or read off the files already in the project.

import { readFileSync } from "node:fs";
import path from "node:path";
import { icons, imageSize } from "./assets.js";
import { configFile, rootDir } from "./paths.js";

const CARD = "/static/og/og-default.png";

function parseIni(source) {
  const data = {};
  let section = {};

  for (const line of source.split(/\r?\n/)) {
    const text = line.trim();
    if (text === "" || text.startsWith("#") || text.startsWith(";")) continue;

    const heading = text.match(/^\[(.+)\]$/);
    if (heading) {
      section = data[heading[1].trim()] ??= {};
      continue;
    }

    const pair = text.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (pair) section[pair[1].trim()] = pair[2].trim();
  }

  return data;
}

function list(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const ini = parseIni(readFileSync(configFile, "utf8"));
const settings = (name) => ini[name] ?? {};

const siteIni = settings("site");
const authorIni = settings("author");
const serverIni = settings("server");
const url = (siteIni.url || "http://localhost").replace(/\/+$/, "");
const language = siteIni.language || "en";

export const site = {
  url,
  host: new URL(url).host,
  name: siteIni.name || new URL(url).host,
  shortName: siteIni.short_name || siteIni.name,
  // <html lang> and schema.org take the BCP-47 tag; Open Graph wants the
  // underscored form, and only when the tag names a region.
  lang: language,
  locale: language.includes("-") ? language.replace("-", "_") : null,
  description: siteIni.description || "",
  keywords: list(siteIni.keywords),
  author: {
    name: authorIni.name || siteIni.name,
    role: authorIni.role || "",
    affiliation: authorIni.affiliation || "",
    sameAs: list(authorIni.links),
  },
  image: {
    path: CARD,
    alt: siteIni.card_alt || "",
    source: path.resolve(rootDir, siteIni.card_source || ""),
    ...imageSize(CARD),
  },
  icons: icons(),
  themeColor: {
    light: siteIni.theme_light || "#ffffff",
    dark: siteIni.theme_dark || "#151515",
  },
  search: {
    // Public by design: IndexNow proves a submission came from this host by
    // fetching /<key>.txt. An empty key stops publishing it and skips submission.
    indexNowKey: settings("search").indexnow_key || null,
    // Console ownership tokens, keyed by the exact <meta name> each one requires.
    verification: settings("verification"),
  },
  server: {
    port: Number(serverIni.port) || 1213,
    // Named after the project directory, so a second site generated from this
    // template defaults to its own file instead of overwriting the first one.
    nginxConf: serverIni.nginx_conf || `/etc/nginx/conf.d/${path.basename(rootDir)}.conf`,
  },
};

// Absolute URL for a site-root-relative path. Every canonical, og:url, sitemap
// <loc> and og:image goes through here so the origin is never spelled out twice.
export function absoluteUrl(pathname = "/") {
  return new URL(pathname, `${site.url}/`).href;
}

// Titles read "<page> — <site>", except on the home page where that would stutter.
export function documentTitle(title) {
  return !title || title === site.name ? site.name : `${title} — ${site.name}`;
}
