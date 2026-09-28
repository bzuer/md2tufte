// Tufte's page has two widths: the text column, and the full width that takes in
// the margin as well. A table or code block is set to one or the other by what
// it holds, counted in characters, so a wide table spreads out instead of
// wrapping into slivers and a long line of code is shown whole instead of
// scrolled. The author can still write class="fullwidth" by hand; nothing here
// narrows an element.
//
// Within a table, short columns (numbers, labels) are kept on one line when
// they fit, so the wrapping falls on the prose column: left to itself, the
// browser shares the width out by content length and breaks "39.7 GB" too.
//
// The limits are characters of each element's own type that fit the text column
// at the page's full size (public/static/css/styles.dev.css: a 80rem page, a 55%
// column, tables at 1.3rem, code at 0.9rem monospace indented to 52.5%). They
// move with those values.

import { visit, SKIP } from "unist-util-visit";

// A table whose unwrapped row fits the column, or overruns it by up to a fifth,
// stays in the column: a few cells wrapping is cheaper than breaking the text's
// alignment. Each column also costs about a character of cell padding.
const TABLE_COLUMN = 72;
const TABLE_SLACK = 1.2;
const TABLE_FULL = 120;
const CODE_COLUMN = 76;
const SHORT_CELL = 20;

function textOf(node) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function hasClass(node, name) {
  const value = node.properties?.className;
  return Array.isArray(value) && value.includes(name);
}

function addClass(node, name) {
  if (!hasClass(node, name)) {
    node.properties.className = [...(node.properties.className ?? []), name];
  }
}

function cellsOf(row) {
  return row.children.filter((child) => child.tagName === "td" || child.tagName === "th");
}

function rowsOf(table) {
  const rows = [];
  visit(table, "element", (node) => {
    if (node.tagName === "table" && node !== table) return SKIP;
    if (node.tagName === "tr") rows.push(node);
  });
  return rows;
}

// The longest cell of each column, in characters.
function columnWidths(rows) {
  const columns = [];
  for (const row of rows) {
    cellsOf(row).forEach((cell, index) => {
      columns[index] = Math.max(columns[index] ?? 0, textOf(cell).trim().length);
    });
  }
  return columns;
}

// The width the table would take with no cell wrapped, with a character of
// padding per column.
function naturalWidth(columns) {
  return columns.reduce((sum, width) => sum + width + 1, 0);
}

// Short columns stay unbroken only if together they leave the table room: a
// table of nothing but short columns that overruns its width must still wrap.
function keepShortColumns(rows, columns, capacity) {
  const short = columns.map((width) => width <= SHORT_CELL);
  const kept = columns.filter((width, index) => short[index]);
  if (!kept.length || naturalWidth(kept) > capacity) return;

  for (const row of rows) {
    cellsOf(row).forEach((cell, index) => {
      if (short[index]) addClass(cell, "nowrap");
    });
  }
}

function longestLine(code) {
  return Math.max(0, ...textOf(code).split("\n").map((line) => line.length));
}

export function rehypeWidths() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "table") {
        const rows = rowsOf(node);
        const columns = columnWidths(rows);
        if (naturalWidth(columns) > TABLE_COLUMN * TABLE_SLACK) addClass(node, "fullwidth");
        keepShortColumns(rows, columns, hasClass(node, "fullwidth") ? TABLE_FULL : TABLE_COLUMN);
      }

      if (node.tagName === "code" && parent?.tagName === "pre" && longestLine(node) > CODE_COLUMN) {
        addClass(parent, "fullwidth");
      }
    });
  };
}
