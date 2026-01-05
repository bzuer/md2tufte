import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

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

function getContentType(filePath) {
  return imageMimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

async function copyDir(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyDir(sourcePath, destinationPath);
        return;
      }

      if (entry.isFile()) {
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
        if (!resolvedPath.startsWith(contentImgDirWithSep)) {
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

      await copyDir(contentImgDir, path.join(outDir, "static", "img"));
    },
  };
}

export default defineConfig({
  output: "static",
  build: {
    assets: "static/_astro",
  },
  vite: {
    plugins: [contentImagesPlugin()],
    preview: {
      allowedHosts: ["cruz.rio.br", "www.cruz.rio.br"],
    },
  },
});
