// Facts read off the files in public/static/ instead of being written down a
// second time: image dimensions, the icon set, and the hashed stylesheet URL.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { publicPath } from "./paths.js";

const ICONS = "/static/icons/";
const STYLESHEET = "/static/css/styles.min.css";

// PNG dimensions live in the IHDR chunk, at a fixed offset in the header.
export function imageSize(urlPath) {
  try {
    const bytes = readFileSync(publicPath(urlPath));
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } catch {
    return { width: null, height: null };
  }
}

// An .ico holds several images; each directory entry starts with its own
// dimensions, where a stored 0 means 256.
function icoSizes(urlPath) {
  const bytes = readFileSync(publicPath(urlPath));
  const count = bytes.readUInt16LE(4);
  return Array.from({ length: count }, (entry, index) => {
    const offset = 6 + index * 16;
    return `${bytes[offset] || 256}x${bytes[offset + 1] || 256}`;
  }).join(" ");
}

function pngIcon(name) {
  const iconPath = `${ICONS}${name}`;
  const { width, height } = imageSize(iconPath);
  return { path: iconPath, sizes: `${width}x${height}`, width };
}

// The set is whatever public/static/icons/ holds, classified by filename:
// favicon.ico and favicon-*.png for the browser, apple-touch-icon.png for iOS,
// android-chrome-*.png for the install manifest.
export function icons() {
  let files = [];
  try {
    files = readdirSync(publicPath(ICONS));
  } catch {
    files = [];
  }

  const png = files.filter((name) => name.endsWith(".png")).map(pngIcon);
  const bySize = (a, b) => a.width - b.width;
  const named = (prefix) => png.filter((icon) => icon.path.startsWith(`${ICONS}${prefix}`));

  return {
    ico: files.includes("favicon.ico")
      ? { path: `${ICONS}favicon.ico`, sizes: icoSizes(`${ICONS}favicon.ico`) }
      : null,
    png: named("favicon-").sort(bySize),
    appleTouch: named("apple-touch-icon")[0] ?? null,
    app: named("android-chrome-").sort(bySize),
  };
}

// Hashed by content in production so a changed stylesheet busts its cache; the
// unminified source, uncached, in dev.
export function stylesheetHref({ dev = false } = {}) {
  if (dev) {
    return `/static/css/styles.dev.css?v=${Date.now()}`;
  }

  const css = readFileSync(publicPath(STYLESHEET), "utf8");
  return `${STYLESHEET}?v=${createHash("sha256").update(css).digest("hex").slice(0, 8)}`;
}
