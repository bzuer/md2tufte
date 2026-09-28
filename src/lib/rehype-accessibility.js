// What the page needs to be read without a mouse or without sight, added to the
// rendered tree so the author never writes it by hand. It runs after rehype-raw,
// so the markup the author wrote as raw HTML is covered along with what the
// pipeline generated:
//
//   - every box that can scroll sideways is reachable from the keyboard: a table
//     is wrapped in a focusable .table-scroll box (the stylesheet lets it scroll
//     on a narrow screen instead of widening the page), and code blocks and
//     display math take tabindex="0" themselves;
//   - a header cell with nothing in it becomes a data cell. GFM requires a header
//     row, so a table meant to have none arrives with an empty one, and an empty
//     header announces nothing for the cells it heads;
//   - a task-list checkbox is labelled by its item's text;
//   - a margin toggle is named for what it opens. A sidenote's number is drawn by
//     a CSS counter, which browsers leave out of an accessible name, and a margin
//     note's ⊕ reads as "circled plus", so each label gains a visually hidden
//     "Sidenote 3" or "Margin note". Sidenotes are counted here in document order,
//     the order the CSS counter follows, so the name matches the number shown.

import { visit } from "unist-util-visit";

// Elements that end the inline run a task-list checkbox is labelled by.
const BLOCK = new Set([
  "blockquote", "div", "dl", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "ol", "p", "pre", "table", "ul",
]);
// Content that labels a header cell without being text.
const EMBEDDED = new Set(["img", "math", "svg"]);
const LETTER = /[\p{L}\p{N}]/u;

function hasClass(node, name) {
  const value = node.properties?.className;
  return Array.isArray(value) && value.includes(name);
}

function element(tagName, properties, children) {
  return { type: "element", tagName, properties, children };
}

function textOf(node) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function isEmpty(node) {
  if (node.type === "text") return node.value.trim() === "";
  if (node.type !== "element") return true;
  return !EMBEDDED.has(node.tagName) && node.children.every(isEmpty);
}

function isCheckbox(node) {
  return node.type === "element" && node.tagName === "input" && node.properties?.type === "checkbox";
}

function makeFocusable(node) {
  if (node.properties.tabIndex === undefined) node.properties.tabIndex = 0;
}

// A tight list puts the checkbox straight in the <li>, a loose one in a <p>.
// The label takes the checkbox and the inline run after it, stopping short of a
// nested list.
function labelTask(item) {
  const host = item.children.some(isCheckbox)
    ? item
    : item.children.find((child) => child.tagName === "p" && child.children.some(isCheckbox));
  if (!host) return;

  const start = host.children.findIndex(isCheckbox);
  let end = start + 1;
  while (end < host.children.length && !BLOCK.has(host.children[end].tagName)) end += 1;

  host.children.splice(start, end - start, element("label", {}, host.children.slice(start, end)));
}

// A label the author already worded is left alone; only a symbol or nothing at
// all is replaced for assistive technology.
function nameToggle(label, number) {
  if (label.children.some((child) => hasClass(child, "visually-hidden"))) return;
  if (LETTER.test(textOf(label))) return;

  const name = element("span", { className: ["visually-hidden"] }, [
    { type: "text", value: number ? `Sidenote ${number}` : "Margin note" },
  ]);
  const glyph = label.children.length
    ? [element("span", { ariaHidden: "true" }, label.children)]
    : [];

  label.children = [name, ...glyph];
}

export function rehypeAccessibility() {
  return (tree) => {
    let sidenotes = 0;

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "th" && isEmpty(node)) node.tagName = "td";
      if (node.tagName === "code" && parent?.tagName === "pre") makeFocusable(node);
      if (hasClass(node, "katex-display")) makeFocusable(node);
      if (node.tagName === "li" && hasClass(node, "task-list-item")) labelTask(node);
      if (node.tagName === "label" && hasClass(node, "margin-toggle")) {
        const sidenote = hasClass(node, "sidenote-number");
        if (sidenote) sidenotes += 1;
        nameToggle(node, sidenote ? sidenotes : null);
      }

      if (node.tagName === "table" && parent && typeof index === "number" && !hasClass(parent, "table-scroll")) {
        parent.children[index] = element("div", { className: ["table-scroll"], tabIndex: 0 }, [node]);
      }
    });
  };
}
