// Optional YAML-subset frontmatter. Content files are not required to carry any:
// a plain Markdown file still yields complete metadata through src/lib/metadata.js.
// Supported: scalars, quoted scalars, booleans, inline arrays and block sequences.

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const KEY = /^([A-Za-z][\w-]*):[ \t]*(.*)$/;
const SEQUENCE_ITEM = /^[ \t]*-[ \t]+(.*)$/;

function unquote(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
    return value.slice(1, -1).replace(/\\(["'\\])/g, "$1");
  }
  return value;
}

// Splits on commas that sit outside quotes, so ["a, b", c] stays two entries.
function splitInline(value) {
  const items = [];
  let current = "";
  let quote = null;

  for (const character of value) {
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === ",") {
      items.push(current);
      current = "";
    } else current += character;
  }
  items.push(current);

  return items.map((item) => item.trim()).filter((item) => item !== "");
}

// Scalars stay strings on purpose: dates keep their literal form instead of being
// coerced the way a full YAML parser would.
function parseScalar(raw) {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    return splitInline(value.slice(1, -1)).map(unquote);
  }
  return unquote(value);
}

function parseBlock(block) {
  const data = {};
  let sequenceKey = null;

  for (const line of block.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    const item = line.match(SEQUENCE_ITEM);
    if (item && sequenceKey) {
      data[sequenceKey].push(parseScalar(item[1]));
      continue;
    }

    const pair = line.match(KEY);
    if (!pair) continue;

    const [, key, rest] = pair;
    if (rest.trim() === "") {
      data[key] = [];
      sequenceKey = key;
      continue;
    }

    data[key] = parseScalar(rest);
    sequenceKey = null;
  }

  return data;
}

export function splitFrontmatter(source) {
  const match = source.match(FRONTMATTER);
  if (!match) {
    return { data: {}, body: source };
  }
  return { data: parseBlock(match[1]), body: source.slice(match[0].length) };
}
