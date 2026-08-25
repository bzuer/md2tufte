// Minifies public/static/css/styles.dev.css into styles.min.css, keeping
// /*! ... */ license comments. Edit the .dev.css source, never the output.

import { readFile, writeFile } from "node:fs/promises";
import { publicPath } from "../src/lib/paths.js";

const source = publicPath("/static/css/styles.dev.css");
const target = publicPath("/static/css/styles.min.css");

function minify(css) {
  return `${css
    .replace(/\/\*[^!][\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([:;{},>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim()}\n`;
}

await writeFile(target, minify(await readFile(source, "utf8")), "utf8");
