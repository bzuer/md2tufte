// Regenerates the social card and the icon set from content/img/imga.png.
//
// Run on demand, not as part of `npm run build`: the outputs are committed static
// branding that only changes when the source artwork does, and keeping sharp out
// of the render path leaves the build dependency-free.
//
//   node scripts/build-og.js

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(rootDir, "content", "img", "imga.png");
const ogDir = path.join(rootDir, "public", "static", "og");
const iconDir = path.join(rootDir, "public", "static", "icons");

const BACKGROUND = "#ffffff";

// The site mark: three linked nodes, echoing the point-and-line artwork.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Bruno Cruz">
  <g fill="none" stroke="#5e8b6a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 47 L32 15 L49 47 Z" />
  </g>
  <g fill="#e6aa62">
    <circle cx="32" cy="15" r="7" />
    <circle cx="15" cy="47" r="7" />
    <circle cx="49" cy="47" r="7" />
  </g>
</svg>
`;

// The source drawing carries wide transparent margins, so it is trimmed to its ink
// first and then centred on the card. Cropping to fill would cut the plan in half.
async function buildSocialCard() {
  await mkdir(ogDir, { recursive: true });
  const target = path.join(ogDir, "og-default.png");

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

  return target;
}

async function buildIcons() {
  await mkdir(iconDir, { recursive: true });
  const svgPath = path.join(iconDir, "favicon.svg");
  await writeFile(svgPath, faviconSvg, "utf8");

  const svg = Buffer.from(faviconSvg);
  const favicon = path.join(iconDir, "favicon-32.png");
  const appleTouchIcon = path.join(iconDir, "apple-touch-icon.png");

  await sharp(svg, { density: 384 }).resize(32, 32).png({ compressionLevel: 9 }).toFile(favicon);

  // Apple renders these on an opaque tile, so the transparency is flattened here.
  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(appleTouchIcon);

  return [svgPath, favicon, appleTouchIcon];
}

const written = [await buildSocialCard(), ...(await buildIcons())];
for (const file of written) {
  const { size } = await sharp(file).metadata().then(
    async (meta) => ({ size: `${meta.width}x${meta.height}` }),
    () => ({ size: "svg" })
  );
  console.log(`${path.relative(rootDir, file)} (${size})`);
}
