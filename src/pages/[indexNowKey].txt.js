// IndexNow verification file. The receiving engines fetch /<key>.txt and compare
// its contents with the key in the submission, which is how they know the request
// came from someone who controls this host. The key is public by design.
//
// Emitted from src/lib/site.js so the key exists in exactly one place; setting
// search.indexNowKey to null removes the file and skips submission in
// scripts/publish.sh. Static routes win over dynamic ones, so /robots.txt and
// /sitemap.xml are unaffected.

import { site } from "../lib/site.js";

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
