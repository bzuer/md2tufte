import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { site } from "./src/lib/site.js";

const contentImgDir = path.resolve(fileURLToPath(new URL("./content/img", import.meta.url)));
const contentImgDirWithSep = `${contentImgDir}${path.sep}`;
const imageRequestPrefix = "/static/img/";
const imageMimeTypes = new Map([
  [".apng", "image/apng"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function isImageFile(filePath) {
  return imageMimeTypes.has(path.extname(filePath).toLowerCase());
}

function getContentType(filePath) {
  return imageMimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

// Copies only image files, so non-image sources (e.g. image-maker.py) are never published.
async function copyImages(source, destination) {
  const entries = await fs.readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyImages(sourcePath, destinationPath);
        return;
      }

      if (entry.isFile() && isImageFile(sourcePath)) {
        await fs.mkdir(destination, { recursive: true });
        await fs.copyFile(sourcePath, destinationPath);
      }
    })
  );
}

function contentImagesPlugin() {
  let outDir = null;

  return {
    name: "content-images",
    configResolved(resolved) {
      outDir = resolved.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const [rawUrl] = req.url.split("?");
        if (!rawUrl.startsWith(imageRequestPrefix)) {
          next();
          return;
        }

        const relativePath = decodeURIComponent(rawUrl.slice(imageRequestPrefix.length));
        const resolvedPath = path.resolve(contentImgDir, relativePath);
        if (!resolvedPath.startsWith(contentImgDirWithSep) || !isImageFile(resolvedPath)) {
          next();
          return;
        }

        try {
          const stats = await fs.stat(resolvedPath);
          if (!stats.isFile()) {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", getContentType(resolvedPath));
          createReadStream(resolvedPath).pipe(res);
        } catch (error) {
          next();
        }
      });
    },
    async generateBundle() {
      if (!outDir) {
        return;
      }

      try {
        const stats = await fs.stat(contentImgDir);
        if (!stats.isDirectory()) {
          return;
        }
      } catch (error) {
        return;
      }

      await copyImages(contentImgDir, path.join(outDir, "static", "img"));
    },
  };
}

export default defineConfig({
  // The origin every canonical URL, og:url and sitemap <loc> is built from.
  site: site.url,
  output: "static",
  // "never" + "file" make /md2tufte the single canonical form: Astro emits
  // md2tufte.html instead of md2tufte/index.html, and Nginx redirects the
  // trailing-slash variant. See scripts/setup-nginx.sh.
  trailingSlash: "never",
  build: {
    assets: "static/_astro",
    format: "file",
  },
  vite: {
    plugins: [contentImagesPlugin()],
    preview: {
      allowedHosts: ["cruz.rio.br", "www.cruz.rio.br"],
    },
  },
});
