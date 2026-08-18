// Generated rather than kept in public/ so the sitemap URL stays tied to
// src/lib/site.js and cannot drift from the origin the canonical tags use.

import { absoluteUrl } from "../lib/site.js";

export const prerender = true;

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
