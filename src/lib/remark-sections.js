// Turns a page's headings into its structure, so one Markdown file can hold
// several anchor sections with no markup beyond its own headings:
//
//   - the page title is the h1: the frontmatter title (inline Markdown allowed),
//     or, without one, the file's first # heading, which then leaves the flow;
//   - every other # opens a <section> whose id is its anchor (/page#anchor), from
//     a trailing {#id} or else from the heading's words. Two or more sections are
//     listed in a <nav class="contents"> ahead of the first, after the lead;
//   - each heading is set one rank down — # as h2, ## as h3, ### as h4 — since the
//     title holds the h1.
//
// It runs after remarkSidenotes, so a note in a heading is already an HTML node,
// and stays out of the anchor and the contents.

const EXPLICIT_ID = /[ \t]*\{#([A-Za-z][\w-]*)\}[ \t]*$/;
const HTML_ID = /\sid\s*=\s*["']?([^"'\s>]+)/g;

function textOf(node) {
  if (node.type === "html") return "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

// Letters keep their base form, so "Seção 2" is reached as #secao-2.
function slugify(text) {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function takeExplicitId(heading) {
  const last = heading.children.at(-1);
  if (last?.type !== "text") return null;

  const match = last.value.match(EXPLICIT_ID);
  if (!match) return null;

  last.value = last.value.slice(0, match.index);
  if (last.value === "") heading.children.pop();
  return match[1];
}

function walk(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) walk(child, visitor);
}

function element(type, hName, hProperties, children) {
  return { type, data: { hName, hProperties }, children };
}

function contents(sections) {
  const items = sections.map(({ id, title }) => ({
    type: "listItem",
    spread: false,
    children: [
      {
        type: "paragraph",
        children: [{ type: "link", url: `#${id}`, children: [{ type: "text", value: title }] }],
      },
    ],
  }));

  return element("contents", "nav", { className: ["contents"], ariaLabel: "Contents" }, [
    { type: "list", ordered: false, spread: false, children: items },
  ]);
}

export function remarkSections({ title, reservedIds = [] } = {}) {
  const processor = this;

  return (tree) => {
    const used = new Set(reservedIds);
    const headings = [];

    walk(tree, (node) => {
      if (node.type === "html") {
        for (const [, id] of node.value.matchAll(HTML_ID)) used.add(id);
      }
      if (node.type === "heading") headings.push({ node, id: takeExplicitId(node) });
    });

    const unique = (base) => {
      let id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
      used.add(id);
      return id;
    };

    // Ids the author chose are claimed first, so a derived one never takes them.
    for (const heading of headings) {
      if (heading.id) heading.id = unique(heading.id);
    }

    const children = [...tree.children];
    let titleNode = null;

    if (typeof title === "string" && title.trim()) {
      const [first] = processor.parse(title).children;
      titleNode = {
        type: "heading",
        depth: 1,
        children: first?.type === "paragraph" ? first.children : [{ type: "text", value: title }],
      };
    } else {
      const index = children.findIndex((node) => node.type === "heading" && node.depth === 1);
      if (index !== -1) [titleNode] = children.splice(index, 1);
    }

    for (const { node, id } of headings) {
      if (node === titleNode) continue;
      node.depth = Math.min(node.depth + 1, 6);
      // Below the section level, {#id} stays on the heading as its own anchor.
      if (id && node.depth > 2) node.data = { ...node.data, hProperties: { id } };
    }

    const explicit = new Map(headings.map(({ node, id }) => [node, id]));
    const lead = [];
    const sections = [];

    for (const node of children) {
      if (node.type === "heading" && node.depth === 2) {
        const name = textOf(node).trim();
        sections.push({ id: explicit.get(node) || unique(slugify(name)), title: name, nodes: [node] });
      } else if (sections.length) {
        sections.at(-1).nodes.push(node);
      } else {
        lead.push(node);
      }
    }

    const opening = titleNode ? [titleNode, ...lead] : lead;
    tree.children = [
      ...(opening.length ? [element("section", "section", {}, opening)] : []),
      ...(sections.length > 1 ? [contents(sections)] : []),
      ...sections.map(({ id, nodes }) => element("section", "section", { id }, nodes)),
    ];
  };
}
