// Generated so the install name, theme colour and icon set cannot drift from
// config.ini. Referenced from <head> by src/components/SiteHead.astro.

import { site } from "../lib/config.js";

export const prerender = true;

// display: "browser" is deliberate. This is a document, not an application, and
// hiding the address bar would take the URL away from a reader who wants to cite it.
export function GET() {
  const manifest = {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    lang: site.lang,
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: site.themeColor.light,
    theme_color: site.themeColor.light,
    // No "maskable" purpose: the mark runs to the edge of the tile, so a maskable
    // crop would cut into it. Android will letterbox these instead.
    icons: site.icons.app.map((icon) => ({
      src: icon.path,
      sizes: icon.sizes,
      type: "image/png",
    })),
  };

  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
