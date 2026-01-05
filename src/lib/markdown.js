import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { remarkSidenotes } from "./remark-sidenotes.js";

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

export async function renderMarkdown(markdown) {
  const renderInline = createInlineRenderer();
  const renderBlocks = createBlockRenderer();
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkSidenotes, { renderInline, renderBlocks })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeStringify);

  const result = await processor.process(markdown);
  return String(result);
}
