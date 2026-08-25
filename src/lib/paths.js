// Every path in the project resolves from the working directory: Astro and the
// scripts all run from the project root, and this module is bundled into
// dist/.prerender/chunks/ at build time, where a module-relative path would
// point outside the project.

import path from "node:path";

export const rootDir = process.cwd();
export const configFile = path.join(rootDir, "config.ini");
export const contentDir = path.join(rootDir, "content");
export const publicDir = path.join(rootDir, "public");
export const distDir = path.join(rootDir, "dist");

// public/ mirrors the site root, so a URL path is also the path on disk.
export function publicPath(urlPath) {
  return path.join(publicDir, urlPath.replace(/^\//, ""));
}
