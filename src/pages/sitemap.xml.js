// Generated from the same content enumeration the [slug] route uses, so a new
// Markdown file appears as a route and a sitemap entry in the same build.
// Only <loc> and <lastmod> are emitted: changefreq and priority are ignored by
// every major crawler, and inventing values for them would be noise.

import { listContentPages } from "../lib/content.js";
import { absoluteUrl } from "../lib/site.js";

export const prerender = true;

const XML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character]);
}

export async function GET() {
  const pages = await listContentPages();
  const entries = pages
    .filter((page) => page.data.noindex !== true)
    .map((page) =>
      [
        "  <url>",
        `    <loc>${escapeXml(absoluteUrl(page.pathname))}</loc>`,
        `    <lastmod>${escapeXml(page.modified)}</lastmod>`,
        "  </url>",
      ].join("\n")
    );

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
