// Regenerates the social card from content/img/imga.png.
//
// Run on demand, not as part of `npm run build`: the output is committed static
// branding that only changes when the source artwork does, and keeping sharp out
// of the render path leaves the build dependency-free.
//
// The icon set in public/static/icons/ is authored artwork, not generated — this
// script must never write to it.
//
//   node scripts/build-og.js

import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(rootDir, "content", "img", "imga.png");
const target = path.join(rootDir, "public", "static", "og", "og-default.png");

const BACKGROUND = "#ffffff";

// The source drawing carries wide transparent margins, so it is trimmed to its ink
// first and then centred on the card. Cropping to fill would cut the plan in half.
const artwork = await sharp(source)
  .trim()
  .resize(1080, 510, { fit: "inside" })
  .flatten({ background: BACKGROUND })
  .toBuffer();

await sharp({
  create: { width: 1200, height: 630, channels: 3, background: BACKGROUND },
})
  .composite([{ input: artwork, gravity: "centre" }])
  .png({ compressionLevel: 9, palette: true })
  .toFile(target);

const { width, height } = await sharp(target).metadata();
console.log(`${path.relative(rootDir, target)} (${width}x${height})`);
