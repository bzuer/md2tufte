import { visit, SKIP } from "unist-util-visit";

const OPENER = "^[";
const MARGINNOTE = /^\s*\{:\s*\.marginnote\s*\}/;

function stripWrappingParagraph(html) {
  const trimmed = html.trim();
  if (trimmed.startsWith("<p>") && trimmed.endsWith("</p>")) {
    return trimmed.slice(3, -4);
  }
  return trimmed;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

// A sidenote is numbered by CSS, so its label carries no glyph; a margin note is
// unnumbered and needs a visible ⊕ to open it on a narrow screen.
function sidenote(id, content) {
  return (
    `<label for="${id}" class="margin-toggle sidenote-number"></label>` +
    `<input type="checkbox" id="${id}" class="margin-toggle" />` +
    `<span class="sidenote">${content}</span>`
  );
}

function marginnote(id, content) {
  return (
    `<label for="${id}" class="margin-toggle">&#8853;</label>` +
    `<input type="checkbox" id="${id}" class="margin-toggle" />` +
    `<span class="marginnote">${content}</span>`
  );
}

// The note runs from "^[" to the next "]", and remark has already split the
// paragraph at every inline construct in between — a link, emphasis, code or an
// autolinked address each end one text node and start another. So the note is
// collected across siblings rather than inside a single one, which is what makes
// ^[a note with *emphasis*] a sidenote instead of literal text on the page.
function collectNote(children, start, offset) {
  const content = [];

  for (let index = start; index < children.length; index += 1) {
    const child = children[index];

    if (child.type !== "text") {
      content.push(child);
      continue;
    }

    const value = index === start ? child.value.slice(offset) : child.value;
    const close = value.indexOf("]");

    if (close === -1) {
      if (value) content.push({ type: "text", value });
      continue;
    }

    if (close > 0) content.push({ type: "text", value: value.slice(0, close) });
    return { content, end: index, rest: value.slice(close + 1) };
  }

  // Unterminated: leave the text exactly as the author wrote it.
  return null;
}

export function remarkSidenotes(options = {}) {
  const renderInline = options.renderInline;
  const renderBlocks = options.renderBlocks;
  let counter = 0;
  let marginCounter = 0;
  const footnotes = new Map();

  const render = (nodes) =>
    renderBlocks ? stripWrappingParagraph(renderBlocks(nodes)) : "";

  // mdast-util-to-hast separates root children with newlines. Wrapping an inline
  // run in a paragraph and stripping the paragraph back off keeps the note's text
  // exactly as the author spaced it.
  const renderNote = (nodes) => render([{ type: "paragraph", children: nodes }]);

  return (tree) => {
    visit(tree, "footnoteDefinition", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const key = (node.identifier || "").toLowerCase();
      if (key && renderBlocks) {
        footnotes.set(key, render(node.children || []));
      }

      parent.children.splice(index, 1);
      return [SKIP, index];
    });

    visit(tree, (node) => {
      if (!Array.isArray(node.children)) {
        return;
      }

      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        if (child.type !== "text") continue;

        const open = child.value.indexOf(OPENER);
        if (open === -1) continue;

        const note = collectNote(node.children, index, open + OPENER.length);
        if (!note) continue;

        counter += 1;
        const before = child.value.slice(0, open);
        const replacement = [];
        if (before) replacement.push({ type: "text", value: before });
        replacement.push({ type: "html", value: sidenote(`sn-${counter}`, renderNote(note.content)) });
        if (note.rest) replacement.push({ type: "text", value: note.rest });

        node.children.splice(index, note.end - index + 1, ...replacement);
        // Land on the inserted note, so the text after it is scanned next and a
        // second ^[…] on the same line is not missed.
        index += before ? 1 : 0;
      }
    });

    visit(tree, "image", (node, index, parent) => {
      if (!parent || typeof index !== "number" || !node.title) {
        return;
      }

      const alt = escapeAttribute(node.alt || "");
      const src = escapeAttribute(node.url || "");
      const caption = renderInline ? renderInline(node.title) : escapeHtml(node.title);
      const html =
        `<figure><img src="${src}" alt="${alt}" /></figure>` +
        `<span class="marginnote">${caption}</span>`;

      parent.children.splice(index, 1, { type: "html", value: html });
      return index + 1;
    });

    // *text*{:.marginnote} and [text](url){:.marginnote}: the trailing attribute
    // block is a text sibling of the emphasis or link it applies to.
    visit(tree, (node) => node.type === "emphasis" || node.type === "link", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const next = parent.children[index + 1];
      if (!next || next.type !== "text") {
        return;
      }

      const match = next.value.match(MARGINNOTE);
      if (!match) {
        return;
      }

      marginCounter += 1;
      const html = marginnote(`mn-${marginCounter}`, renderNote([node]));
      parent.children.splice(index, 1, { type: "html", value: html });

      const rest = next.value.slice(match[0].length);
      if (rest.trim().length === 0) {
        parent.children.splice(index + 1, 1);
      } else {
        next.value = rest;
      }

      return index + 1;
    });

    visit(tree, "footnoteReference", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const key = (node.identifier || "").toLowerCase();
      const note = footnotes.get(key) || escapeHtml(key || "");
      counter += 1;

      parent.children.splice(index, 1, { type: "html", value: sidenote(`sn-${counter}`, note) });
      return index + 1;
    });
  };
}
