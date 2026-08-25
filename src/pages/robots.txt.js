// Generated rather than kept in public/ so the sitemap URL stays tied to
// config.ini and cannot drift from the origin the canonical tags use.

import { absoluteUrl } from "../lib/config.js";

export const prerender = true;

export function GET() {
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${absoluteUrl("/sitemap.xml")}`, ""];

  return new Response(body.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
