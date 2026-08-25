// Vite plugin serving content/img/ at /static/img/ in dev and copying it into
// the build. Only image files travel, so anything else the author keeps beside
// the artwork is never published.

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { contentDir } from "./paths.js";

const imageDir = path.join(contentDir, "img");
const prefix = "/static/img/";
const mimeTypes = new Map([
  [".apng", "image/apng"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function mimeType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase());
}

async function copyImages(source, destination) {
  const entries = await fs.readdir(source, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);

      if (entry.isDirectory()) return copyImages(from, to);
      if (!entry.isFile() || !mimeType(from)) return;

      await fs.mkdir(destination, { recursive: true });
      await fs.copyFile(from, to);
    })
  );
}

export function contentImages() {
  let outDir = null;

  return {
    name: "content-images",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const [url] = (request.url ?? "").split("?");
        if (!url.startsWith(prefix)) return next();

        const filePath = path.resolve(imageDir, decodeURIComponent(url.slice(prefix.length)));
        if (!filePath.startsWith(`${imageDir}${path.sep}`) || !mimeType(filePath)) return next();

        try {
          if (!(await fs.stat(filePath)).isFile()) return next();
        } catch {
          return next();
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", mimeType(filePath));
        createReadStream(filePath).pipe(response);
      });
    },
    async generateBundle() {
      try {
        if (!outDir || !(await fs.stat(imageDir)).isDirectory()) return;
      } catch {
        return;
      }

      await copyImages(imageDir, path.join(outDir, "static", "img"));
    },
  };
}
