// Schema.org graph for the page head. Nodes are @id-linked so the Person and
// WebSite are declared once and referenced from every page.
// No email or telephone node: the page body publishes contact details obfuscated
// (src/lib/rehype-contacts.js), and a JSON-LD block is the first thing a harvester
// reads, so repeating them here would undo that.

import { site, absoluteUrl } from "./config.js";

const WEBSITE_ID = `${site.url}/#website`;
const PERSON_ID = `${site.url}/#person`;

function personNode() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: site.author.name,
    url: absoluteUrl("/"),
    ...(site.author.role ? { jobTitle: site.author.role } : {}),
    ...(site.author.affiliation
      ? { affiliation: { "@type": "CollegeOrUniversity", name: site.author.affiliation } }
      : {}),
    sameAs: site.author.sameAs,
  };
}

function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: site.name,
    description: site.description,
    inLanguage: site.lang,
    publisher: { "@id": PERSON_ID },
  };
}

function imageNode(metadata) {
  return {
    "@type": "ImageObject",
    url: metadata.image.url,
    ...(metadata.image.width ? { width: metadata.image.width } : {}),
    ...(metadata.image.height ? { height: metadata.image.height } : {}),
  };
}

function pageNode(metadata) {
  const isArticle = metadata.type === "article";

  return {
    "@type": isArticle ? "Article" : "WebPage",
    "@id": `${metadata.canonical}#page`,
    url: metadata.canonical,
    name: metadata.title,
    ...(isArticle ? { headline: metadata.title } : {}),
    description: metadata.description,
    inLanguage: site.lang,
    isPartOf: { "@id": WEBSITE_ID },
    ...(isArticle ? { author: { "@id": PERSON_ID } } : { about: { "@id": PERSON_ID } }),
    ...(isArticle ? { mainEntityOfPage: metadata.canonical } : {}),
    ...(metadata.published ? { datePublished: metadata.published } : {}),
    ...(metadata.modified ? { dateModified: metadata.modified } : {}),
    primaryImageOfPage: imageNode(metadata),
  };
}

function breadcrumbNode(metadata) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${metadata.canonical}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: metadata.title, item: metadata.canonical },
    ],
  };
}

export function buildStructuredData(metadata) {
  const graph = [websiteNode(), personNode(), pageNode(metadata)];
  if (!metadata.isHome) {
    graph.push(breadcrumbNode(metadata));
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
