import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { remarkSidenotes } from "./remark-sidenotes.js";
import { remarkSections } from "./remark-sections.js";
import { rehypeContacts } from "./rehype-contacts.js";
import { rehypeAccessibility } from "./rehype-accessibility.js";
import { rehypeWidths } from "./rehype-widths.js";
import { rehypeTypography } from "./rehype-typography.js";

function stripWrappingParagraph(html) {
  const trimmed = html.trim();
  if (trimmed.startsWith("<p>") && trimmed.endsWith("</p>")) {
    return trimmed.slice(3, -4);
  }
  return trimmed;
}

function createInlineRenderer() {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeStringify);

  return (value) => {
    const rendered = processor.processSync(value);
    return stripWrappingParagraph(String(rendered));
  };
}

function createBlockRenderer() {
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeStringify);

  return (nodes) => {
    const tree = { type: "root", children: nodes };
    const hast = processor.runSync(tree);
    return String(processor.stringify(hast));
  };
}

// The id BaseLayout gives <main>, the skip link's target: no section may take it.
const LAYOUT_IDS = ["content"];

// The title is the frontmatter's, when it has one (src/lib/remark-sections.js).
export async function renderMarkdown(markdown, { title } = {}) {
  const renderInline = createInlineRenderer();
  const renderBlocks = createBlockRenderer();
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkSidenotes, { renderInline, renderBlocks })
    .use(remarkSections, { title, reservedIds: LAYOUT_IDS })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    // After rehypeRaw, so the anchors the author wrote as raw HTML — and the notes
    // the sidenote plugin rendered to HTML strings — are real elements by now.
    .use(rehypeContacts)
    .use(rehypeTypography)
    .use(rehypeWidths)
    .use(rehypeAccessibility)
    .use(rehypeStringify);

  const result = await processor.process(markdown);
  return String(result);
}
