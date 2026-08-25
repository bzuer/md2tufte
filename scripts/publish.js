// Post-deploy publication: drop the edge cache, then tell the search engines.
//
//   node scripts/publish.js [--skip-purge] [--skip-indexnow]
//
// Run by `scripts/manage.sh deploy` after Nginx reloads. Both steps are optional
// and skip with an explanation rather than failing the deploy, so an unconfigured
// checkout still deploys; a step that is configured and then errors does fail.
//
// Credentials come from the environment or from .env.deploy, which .gitignore
// already covers. They are never printed.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { site } from "../src/lib/config.js";
import { distDir, rootDir } from "../src/lib/paths.js";

const args = process.argv.slice(2);
const sitemapFile = path.join(distDir, "sitemap.xml");

// A KEY=VALUE file, nothing more: no interpolation, no export keyword. Values
// already present in the environment win, so a one-off override works.
async function loadEnvFile() {
  let source;
  try {
    source = await readFile(path.join(rootDir, ".env.deploy"), "utf8");
  } catch {
    return;
  }

  for (const line of source.split("\n")) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

// The whole zone, not a file list. Unhashed assets (images, icons, the social
// card) keep their URL when their bytes change, so a targeted purge would have to
// know what changed; a small site can afford the cold cache instead.
async function purgeCloudflare() {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!zone || !token) {
    return {
      status: "skipped",
      detail: "set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN in .env.deploy",
    };
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ purge_everything: true }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) {
    // Cloudflare reports the reason in errors[]; the token is not echoed back.
    const reason = body.errors?.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare purge failed: ${reason}`);
  }

  return { status: "done", detail: "edge cache purged" };
}

// Submits the indexable URLs to IndexNow, which fans out to Bing, Yandex, Seznam
// and Naver. Google does not participate: it discovers changes from the Sitemap
// line in robots.txt and the <lastmod> in the sitemap, which need no ping — the
// ping endpoint Google used to offer was retired in 2023.
async function submitIndexNow() {
  const key = site.search.indexNowKey;
  if (!key) {
    return { status: "skipped", detail: "search.indexnow_key is empty in config.ini" };
  }

  const sitemap = await readFile(sitemapFile, "utf8");
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) =>
    loc.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
  );

  if (urlList.length === 0) {
    throw new Error(`No <loc> entries in ${path.relative(rootDir, sitemapFile)}`);
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: site.host,
      key,
      keyLocation: `${site.url}/${key}.txt`,
      urlList,
    }),
  });

  // 200 accepted, 202 accepted but the key file has not been read back yet.
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow rejected the submission: HTTP ${response.status}`);
  }

  return { status: "done", detail: `${urlList.length} URL(s) submitted` };
}

async function run(name, task) {
  if (args.includes(`--skip-${name}`)) {
    console.log(`${name.padEnd(11)} skipped — --skip-${name} requested`);
    return true;
  }

  try {
    const { status, detail } = await task();
    console.log(`${name.padEnd(11)} ${status} — ${detail}`);
    return true;
  } catch (error) {
    console.error(`${name.padEnd(11)} FAILED — ${error.message}`);
    return false;
  }
}

await loadEnvFile();
const results = [await run("purge", purgeCloudflare), await run("indexnow", submitIndexNow)];

if (results.includes(false)) process.exit(1);
