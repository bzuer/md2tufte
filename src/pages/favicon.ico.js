// /favicon.ico is probed by crawlers, feed readers and chat unfurlers regardless
// of what <head> declares. Serving it from the icon set in public/static/icons/
// keeps one copy of the file: a second one at the site root could drift from it.

import { readFile } from "node:fs/promises";
import { site } from "../lib/config.js";
import { publicPath } from "../lib/paths.js";

export const prerender = true;

export async function GET() {
  if (!site.icons.ico) {
    return new Response(null, { status: 404 });
  }

  const icon = await readFile(publicPath(site.icons.ico.path));

  return new Response(new Uint8Array(icon), {
    headers: { "Content-Type": "image/x-icon" },
  });
}
