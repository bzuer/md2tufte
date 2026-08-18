// Resolves the stylesheet URL: the unminified source in dev, and the minified
// build hashed by content in production so a changed stylesheet busts its cache.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// Resolved from the working directory for the same reason as src/lib/content.js:
// this module is bundled into dist/.prerender/chunks/, where a module-relative
// path would escape the project.
const cssDir = path.resolve(process.cwd(), "public", "static", "css");

export function stylesheetHref({ dev = false } = {}) {
  if (dev) {
    return `/static/css/styles.dev.css?v=${Date.now()}`;
  }

  const minCss = readFileSync(path.join(cssDir, "styles.min.css"), "utf8");
  const hash = createHash("sha256").update(minCss).digest("hex").slice(0, 8);

  return `/static/css/styles.min.css?v=${hash}`;
}
