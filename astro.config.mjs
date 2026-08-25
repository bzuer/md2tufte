import { defineConfig } from "astro/config";
import { contentImages } from "./src/lib/content-images.js";
import { site } from "./src/lib/config.js";

export default defineConfig({
  // The origin every canonical URL, og:url and sitemap <loc> is built from.
  site: site.url,
  output: "static",
  // "never" + "file" make /page the single canonical form: Astro emits page.html
  // instead of page/index.html, and Nginx redirects the other spellings.
  trailingSlash: "never",
  build: {
    assets: "static/_astro",
    format: "file",
  },
  vite: {
    plugins: [contentImages()],
    // So the built site can also be previewed through the tunnel, not only on
    // 127.0.0.1. Nginx, not preview, is what serves the configured port.
    preview: {
      allowedHosts: [site.host, `www.${site.host}`],
    },
  },
});
