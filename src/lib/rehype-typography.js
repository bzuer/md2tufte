// Keeps a number on the same line as its unit: "48 GB", "17.5 %", "250 ms". A line
// break between them strands the unit at the start of the next line, where it
// reads as a word of its own. The space the author typed becomes a no-break
// space; nothing else in the text changes. Code, math and scripts are left
// alone, since their spaces are content.

import { visit, SKIP } from "unist-util-visit";

const LITERAL = new Set(["code", "kbd", "math", "pre", "samp", "script", "style", "svg"]);
const NUMBER_UNIT = /(\d) (?=(?:[KMGTP]i?B|B|%|ms|min|px|pt|kg|km|cm|mm)(?![\p{L}\p{N}-]))/gu;

function isLiteral(node) {
  const className = node.properties?.className;
  return LITERAL.has(node.tagName) || (Array.isArray(className) && className.includes("katex"));
}

export function rehypeTypography() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type === "element" && isLiteral(node)) return SKIP;
      if (node.type === "text") node.value = node.value.replace(NUMBER_UNIT, "$1 ");
    });
  };
}
