// Regenerates the social card from the artwork named by card_source in
// config.ini. Run on demand, not as part of `npm run build`: the output only
// changes when the source artwork does, and keeping sharp out of the render path
// leaves the build free of image dependencies.
//
// The icon set in public/static/icons/ is authored artwork, not generated — this
// script must never write to it.
//
//   npm run assets

import path from "node:path";
import sharp from "sharp";
import { site } from "../src/lib/config.js";
import { publicPath, rootDir } from "../src/lib/paths.js";

const target = publicPath(site.image.path);
const BACKGROUND = "#ffffff";

// The source drawing carries wide transparent margins, so it is trimmed to its ink
// first and then centred on the card. Cropping to fill would cut the plan in half.
const artwork = await sharp(site.image.source)
  .trim()
  .resize(1080, 510, { fit: "inside" })
  .flatten({ background: BACKGROUND })
  .toBuffer();

await sharp({ create: { width: 1200, height: 630, channels: 3, background: BACKGROUND } })
  .composite([{ input: artwork, gravity: "centre" }])
  .png({ compressionLevel: 9, palette: true })
  .toFile(target);

const { width, height } = await sharp(target).metadata();
console.log(`${path.relative(rootDir, target)} (${width}x${height})`);
