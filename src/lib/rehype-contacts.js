// Contact details are written plainly in Markdown and leave the build obfuscated,
// so the author never encodes an address by hand. Two transforms, neither of which
// needs client-side JavaScript:
//
//   - mailto: and tel: hrefs are percent-encoded, so the address is never a literal
//     string in the markup a harvester greps for. Browsers decode the escapes
//     before handing the URL to the mail or dial client, so the link still works.
//   - an address written into the visible text is split around a hidden decoy. A
//     scraper reading the DOM text harvests a mailbox that cannot receive mail —
//     the decoy leaves a dot against the "@", which no address may carry. A reader
//     sees, copies and hears the real one: display:none content sits outside both
//     the selection and the accessibility tree.
//
// This defeats harvesters that read HTML, which is what crawls a site this size.
// It does not defeat one driving a real browser engine, and without JavaScript
// nothing can.

import { visit } from "unist-util-visit";

const CONTACT_HREF = /^(mailto|tel):(.*)$/i;
const ENCODED = /%[0-9a-f]{2}/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// Deliberately conspicuous: were it ever to render, the author would see it at once.
const DECOY = ".nospam.";
// Element content that is not text; inserting a span into either would corrupt it.
const OPAQUE = new Set(["script", "style"]);

function percentEncode(value) {
  return Array.from(
    new TextEncoder().encode(value),
    (byte) => `%${byte.toString(16).padStart(2, "0")}`
  ).join("");
}

// Only the address is encoded. A mailto may carry ?subject=… &body=…, and escaping
// those separators would fold the whole query into the mailbox name.
function obfuscateHref(scheme, payload) {
  const separator = payload.indexOf("?");
  const address = separator === -1 ? payload : payload.slice(0, separator);
  const query = separator === -1 ? "" : payload.slice(separator);
  return `${scheme}:${percentEncode(address)}${query}`;
}

function decoyNodes(address) {
  const at = address.indexOf("@");
  return [
    { type: "text", value: address.slice(0, at) },
    {
      type: "element",
      tagName: "span",
      properties: { hidden: true },
      children: [{ type: "text", value: DECOY }],
    },
    { type: "text", value: address.slice(at) },
  ];
}

function splitAddresses(value) {
  const nodes = [];
  let lastIndex = 0;
  let match;

  EMAIL.lastIndex = 0;
  while ((match = EMAIL.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, match.index) });
    }
    nodes.push(...decoyNodes(match[0]));
    lastIndex = EMAIL.lastIndex;
  }

  if (!nodes.length) return null;
  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) });
  }

  return nodes;
}

export function rehypeContacts() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;

      const href = node.properties?.href;
      if (typeof href !== "string") return;

      const match = href.match(CONTACT_HREF);
      // An href that already carries escapes is left alone: encoding it twice
      // would turn its % into %25 and break the link.
      if (!match || !match[2] || ENCODED.test(match[2])) return;

      node.properties.href = obfuscateHref(match[1], match[2]);
    });

    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (parent.type === "element" && OPAQUE.has(parent.tagName)) return;

      const nodes = splitAddresses(node.value);
      if (!nodes) return;

      parent.children.splice(index, 1, ...nodes);
      return index + nodes.length;
    });
  };
}
