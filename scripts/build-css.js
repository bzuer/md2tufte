import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const devPath = path.join(rootDir, "public", "static", "css", "styles.dev.css");
const minPath = path.join(rootDir, "public", "static", "css", "styles.min.css");

const minifyCss = (css) => {
  const withoutComments = css.replace(/\/\*[^!][\s\S]*?\*\//g, "");
  const collapsedWhitespace = withoutComments.replace(/\s+/g, " ");
  const tightened = collapsedWhitespace.replace(/\s*([:;{},>])\s*/g, "$1");
  return tightened.replace(/;}/g, "}").trim() + "\n";
};

const build = async () => {
  const css = await readFile(devPath, "utf8");
  const minified = minifyCss(css);
  await writeFile(minPath, minified, "utf8");
};

await build();
