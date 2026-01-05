import { visit, SKIP } from "unist-util-visit";

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

export function remarkSidenotes(options = {}) {
  const renderInline = options.renderInline;
  const renderBlocks = options.renderBlocks;
  let counter = 0;
  let marginCounter = 0;
  const footnotes = new Map();

  return (tree) => {
    visit(tree, "footnoteDefinition", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const key = (node.identifier || "").toLowerCase();
      if (key && renderBlocks) {
        const html = renderBlocks(node.children || []);
        footnotes.set(key, stripWrappingParagraph(html));
      }

      parent.children.splice(index, 1);
      return [SKIP, index];
    });

    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const value = node.value;
      const pattern = /\^\[([\s\S]+?)\]/g;
      let match;
      let lastIndex = 0;
      const nodes = [];

      while ((match = pattern.exec(value))) {
        if (match.index > lastIndex) {
          nodes.push({ type: "text", value: value.slice(lastIndex, match.index) });
        }

        counter += 1;
        const raw = match[1].trim();
        const inner = renderInline ? renderInline(raw) : escapeHtml(raw);
        const noteId = `sn-${counter}`;
        const html =
          `<label for="${noteId}" class="margin-toggle sidenote-number"></label>` +
          `<input type="checkbox" id="${noteId}" class="margin-toggle" />` +
          `<span class="sidenote">${inner}</span>`;
        nodes.push({ type: "html", value: html });
        lastIndex = pattern.lastIndex;
      }

      if (!nodes.length) {
        return;
      }

      if (lastIndex < value.length) {
        nodes.push({ type: "text", value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...nodes);
      return index + nodes.length;
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

    visit(tree, "emphasis", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const next = parent.children[index + 1];
      if (!next || next.type !== "text") {
        return;
      }

      const match = next.value.match(/^\s*\{:\s*\.marginnote\s*\}/);
      if (!match) {
        return;
      }

      const rendered = renderBlocks ? renderBlocks([node]) : "";
      const content = stripWrappingParagraph(rendered);
      marginCounter += 1;
      const noteId = `mn-${marginCounter}`;
      const html =
        `<label for="${noteId}" class="margin-toggle">&#8853;</label>` +
        `<input type="checkbox" id="${noteId}" class="margin-toggle" />` +
        `<span class="marginnote">${content}</span>`;

      parent.children.splice(index, 1, { type: "html", value: html });
      const rest = next.value.slice(match[0].length);
      if (rest.trim().length === 0) {
        parent.children.splice(index + 1, 1);
      } else {
        next.value = rest;
      }

      return index + 1;
    });

    visit(tree, "link", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const next = parent.children[index + 1];
      if (!next || next.type !== "text") {
        return;
      }

      const match = next.value.match(/^\s*\{:\s*\.marginnote\s*\}/);
      if (!match) {
        return;
      }

      const rendered = renderBlocks ? renderBlocks([node]) : "";
      const content = stripWrappingParagraph(rendered);
      marginCounter += 1;
      const noteId = `mn-${marginCounter}`;
      const html =
        `<label for="${noteId}" class="margin-toggle">&#8853;</label>` +
        `<input type="checkbox" id="${noteId}" class="margin-toggle" />` +
        `<span class="marginnote">${content}</span>`;

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
      const noteId = `sn-${counter}`;
      const html =
        `<label for="${noteId}" class="margin-toggle sidenote-number"></label>` +
        `<input type="checkbox" id="${noteId}" class="margin-toggle" />` +
        `<span class="sidenote">${note}</span>`;

      parent.children.splice(index, 1, { type: "html", value: html });
      return index + 1;
    });
  };
}
