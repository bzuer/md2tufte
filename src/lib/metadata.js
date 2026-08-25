// Derives page metadata from the Markdown itself, so a content file needs no
// frontmatter to be fully described. Frontmatter, when present, always wins.

import { site, absoluteUrl, documentTitle } from "./config.js";

const DESCRIPTION_LIMIT = 160;

// Ordered: sidenote and margin-note syntax first, so their payloads never leak
// into a description, then ordinary Markdown emphasis and links.
const INLINE_PATTERNS = [
  [/\^\[(?:[^\][]|\[[^\]]*\])*\]/g, ""], // ^[inline sidenote]
  [/\[\^[^\]]+\]/g, ""], // [^footnote-reference]
  [/\{:\.[\w-]+\}/g, ""], // {:.marginnote}
  [/!\[[^\]]*\]\([^)]*\)/g, ""], // images
  [/\[([^\]]+)\]\([^)]*\)/g, "$1"], // links keep their text
  [/`([^`]+)`/g, "$1"], // inline code
  [/\$\$?[^$]*\$\$?/g, ""], // KaTeX
  [/<[^>]+>/g, ""], // inline HTML
  [/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1"], // emphasis
  [/&[#\w]+;/g, " "], // entities
];

function stripInline(value) {
  return INLINE_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  )
    .replace(/\s+/g, " ")
    .trim();
}

// A block counts as prose only if it is not a heading, fence, list, quote, table,
// footnote definition, or a bare HTML block such as a margin-note figure.
function isProse(block) {
  const first = block.split("\n", 1)[0].trimStart();
  if (first === "") return false;
  return !/^(#{1,6}\s|```|~~~|[-*+]\s|\d+\.\s|>|\||<|\[\^|---|===)/.test(first);
}

function truncate(value, limit) {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, limit);
  const boundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, boundary > 0 ? boundary : limit).replace(/[,;:.\s]+$/, "")}…`;
}

export function deriveTitle(body) {
  const heading = body.match(/^#[ \t]+(.+?)[ \t]*$/m);
  return heading ? stripInline(heading[1]) : "";
}

export function deriveDescription(body) {
  const withoutFences = body.replace(/^```[\s\S]*?^```/gm, "");
  for (const block of withoutFences.split(/\r?\n[ \t]*\r?\n/)) {
    if (!isProse(block)) continue;
    const text = stripInline(block);
    if (text.length >= 40) return truncate(text, DESCRIPTION_LIMIT);
  }
  return "";
}

function resolveImage(data) {
  const { path, alt, width, height } = site.image;
  if (!data.image) return { url: absoluteUrl(path), alt, width, height };

  return {
    url: absoluteUrl(data.image),
    alt: data.imageAlt || alt,
    width: null,
    height: null,
  };
}

export function buildPageMetadata({ data = {}, body = "", pathname, modified = null }) {
  const isHome = pathname === "/";
  const title = data.title || deriveTitle(body) || site.name;
  const description = data.description || deriveDescription(body) || site.description;
  const keywords = data.keywords?.length ? data.keywords : site.keywords;
  const noindex = data.noindex === true;

  return {
    title,
    documentTitle: documentTitle(title),
    description,
    keywords,
    pathname,
    canonical: absoluteUrl(pathname),
    type: isHome ? "website" : "article",
    isHome,
    noindex,
    robots: noindex
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large, max-snippet:-1",
    image: resolveImage(data),
    published: data.date || null,
    modified,
  };
}
