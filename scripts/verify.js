// Post-deploy check against a running origin: every routing and metadata rule the
// site depends on, asserted over HTTP rather than assumed from the build output.
//
//   node scripts/verify.js                            # the public origin
//   node scripts/verify.js --origin http://127.0.0.1:1213   # behind the edge
//
// Exits non-zero on the first failing expectation, so `manage.sh deploy` stops
// with a reason instead of reporting success it has not confirmed.

import { site } from "../src/lib/site.js";

const args = process.argv.slice(2);
const originIndex = args.indexOf("--origin");
const origin = (originIndex === -1 ? site.url : args[originIndex + 1]).replace(/\/$/, "");
const canonicalHost = new URL(site.url).host;

const SECURITY_HEADERS = [
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
  "permissions-policy",
];

const checks = [
  {
    label: "home",
    path: "/",
    status: 200,
    headers: { "content-type": /^text\/html/ },
    body: [
      new RegExp(`<link rel="canonical" href="${site.url}/">`),
      /<meta name="description" content=".+"/,
      /<meta property="og:image" content="[^"]+\/static\/og\//,
      /<meta name="twitter:card" content="summary_large_image">/,
      /<script type="application\/ld\+json">/,
    ],
  },
  {
    label: "article",
    path: "/md2tufte",
    status: 200,
    body: [
      new RegExp(`<link rel="canonical" href="${site.url}/md2tufte">`),
      /<meta property="og:type" content="article">/,
    ],
  },
  { label: "trailing slash", path: "/md2tufte/", status: 301, location: "/md2tufte" },
  { label: ".html suffix", path: "/md2tufte.html", status: 301, location: "/md2tufte" },
  { label: "index.html", path: "/index.html", status: 301, location: "/" },
  { label: "unknown URL", path: "/verify-404-probe", status: 404 },
  {
    label: "robots.txt",
    path: "/robots.txt",
    status: 200,
    headers: { "content-type": /^text\/plain/ },
    body: [new RegExp(`^Sitemap: ${site.url}/sitemap\\.xml$`, "m")],
  },
  {
    label: "sitemap.xml",
    path: "/sitemap.xml",
    status: 200,
    headers: { "content-type": /xml/ },
    body: [/<urlset /, new RegExp(`<loc>${site.url}/</loc>`), /<lastmod>/],
  },
  {
    label: "favicon.ico",
    path: "/favicon.ico",
    status: 200,
    headers: { "content-type": /^image\// },
  },
  {
    label: "manifest",
    path: "/site.webmanifest",
    status: 200,
    body: [/"icons"/, new RegExp(`"theme_color": "${site.themeColor.light}"`)],
  },
  {
    label: "social card",
    path: site.image.path,
    status: 200,
    headers: { "content-type": /^image\/png/ },
  },
  ...site.icons.app.concat(site.icons.png, [site.icons.appleTouch]).map((icon) => ({
    label: `icon ${icon.sizes}`,
    path: icon.path,
    status: 200,
    headers: { "content-type": /^image\/png/ },
  })),
];

if (site.search.indexNowKey) {
  checks.push({
    label: "indexnow key",
    path: `/${site.search.indexNowKey}.txt`,
    status: 200,
    body: [new RegExp(`^${site.search.indexNowKey}$`, "m")],
  });
}

// The www host is folded onto the apex by Nginx, but only the public origin can
// exercise it: a local probe never carries that Host header.
if (new URL(origin).host === canonicalHost) {
  checks.push({
    label: "www redirect",
    url: `https://www.${canonicalHost}/md2tufte`,
    status: 301,
    location: "/md2tufte",
  });
}

function describe(check) {
  return check.url || `${origin}${check.path}`;
}

async function runCheck(check) {
  const url = describe(check);
  const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "md2html-verify" } });
  const problems = [];

  if (response.status !== check.status) {
    problems.push(`status ${response.status}, expected ${check.status}`);
  }

  if (check.location) {
    const location = response.headers.get("location");
    // Cloudflare may rewrite a path-relative Location into an absolute URL, so the
    // comparison is on the resolved pathname rather than the raw header.
    const resolved = location ? new URL(location, url).pathname : null;
    if (resolved !== check.location) {
      problems.push(`redirects to ${location ?? "nothing"}, expected ${check.location}`);
    }
  }

  for (const [header, pattern] of Object.entries(check.headers ?? {})) {
    const value = response.headers.get(header);
    if (!value || !pattern.test(value)) {
      problems.push(`${header}: ${value ?? "absent"}`);
    }
  }

  if (check.body?.length) {
    const text = await response.text();
    for (const pattern of check.body) {
      if (!pattern.test(text)) problems.push(`body missing ${pattern}`);
    }
  }

  return problems;
}

async function runSecurityHeaders() {
  const response = await fetch(`${origin}/`, { headers: { "user-agent": "md2html-verify" } });
  const missing = SECURITY_HEADERS.filter((header) => !response.headers.get(header));
  if (!response.headers.get("cache-control")) missing.push("cache-control");
  return missing.map((header) => `${header}: absent`);
}

console.log(`Verifying ${origin}\n`);

let failed = 0;
for (const check of [...checks, { label: "headers", run: runSecurityHeaders }]) {
  let problems;
  try {
    problems = check.run ? await check.run() : await runCheck(check);
  } catch (error) {
    problems = [error.message];
  }

  if (problems.length === 0) {
    console.log(`  ok    ${check.label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${check.label} — ${problems.join("; ")}`);
  }
}

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);
