// /favicon.ico is probed by crawlers, feed readers and chat unfurlers regardless
// of what <head> declares. Serving it from the icon set in public/static/icons/
// keeps one copy of the file: a second one at the site root could drift from it.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { site } from "../lib/site.js";

export const prerender = true;

// Resolved from the working directory for the same reason as src/lib/content.js:
// this module is bundled into dist/.prerender/chunks/ at build time.
const iconPath = path.resolve(process.cwd(), "public", site.icons.ico.path.replace(/^\//, ""));

export async function GET() {
  const icon = await readFile(iconPath);

  return new Response(new Uint8Array(icon), {
    headers: { "Content-Type": "image/x-icon" },
  });
}
