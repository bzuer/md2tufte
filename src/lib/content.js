// The one place that knows how content/*.md maps to routes. The [slug] route and
// the sitemap both read from here, so a new Markdown file appears in both at once.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { splitFrontmatter } from "./frontmatter.js";

const HOME_FILE = "index.md";

// Resolved from the working directory, not from import.meta.url: the build bundles
// this module into dist/.prerender/chunks/, where a path relative to the module
// would point outside the project. Astro runs dev and build from the project root.
export const contentDir = path.resolve(process.cwd(), "content");

function pathnameFor(filename) {
  return filename === HOME_FILE ? "/" : `/${filename.slice(0, -3)}`;
}

export async function loadContentPage(filename) {
  const filePath = path.join(contentDir, filename);
  const [source, stats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
  const { data, body } = splitFrontmatter(source);

  return {
    filename,
    pathname: pathnameFor(filename),
    slug: filename === HOME_FILE ? null : filename.slice(0, -3),
    data,
    body,
    modified: stats.mtime.toISOString(),
  };
}

// Every Markdown file in content/, home first, then alphabetical — a stable order
// so the generated sitemap does not churn between builds.
export async function listContentFiles() {
  const entries = await readdir(contentDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  return [
    ...files.filter((name) => name === HOME_FILE),
    ...files.filter((name) => name !== HOME_FILE),
  ];
}

export async function listContentPages() {
  const files = await listContentFiles();
  return Promise.all(files.map((filename) => loadContentPage(filename)));
}
