// IndexNow verification file. The receiving engines fetch /<key>.txt and compare
// its contents with the key in the submission, which is how they know the request
// came from someone who controls this host. The key is public by design.
//
// Emptying search.indexnow_key in config.ini removes the file and skips the
// submission in scripts/publish.js. Static routes win over dynamic ones, so
// /robots.txt and /sitemap.xml are unaffected.

import { site } from "../lib/config.js";

export const prerender = true;

export function getStaticPaths() {
  const key = site.search.indexNowKey;
  return key ? [{ params: { indexNowKey: key } }] : [];
}

export function GET({ params }) {
  return new Response(`${params.indexNowKey}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
