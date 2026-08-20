// Single source of truth for every site-wide metadata value. Nothing that ends up
// in a <head>, a sitemap, robots.txt, or the web app manifest is written down
// anywhere else.

const url = "https://cruz.rio.br";

export const site = {
  url,
  name: "Bruno Cruz",
  shortName: "bccc",
  lang: "en",
  locale: "en_US",
  description:
    "Journalist and social scientist. Doctoral researcher in Social Anthropology at the National Museum, Federal University of Rio de Janeiro.",
  keywords: [
    "Bruno Cruz",
    "social anthropology",
    "anthropology",
    "Max Weber",
    "sociology of religion",
    "Museu Nacional",
    "UFRJ",
    "modern Western thought",
  ],
  author: {
    name: "Bruno Cruz",
    email: "cunha@cruz.rio.br",
    affiliation: "Programa de Pós-Graduação em Antropologia Social, Museu Nacional, UFRJ",
    sameAs: [
      "https://github.com/bzuer",
      "https://orcid.org/0000-0001-8652-2333",
      "https://www.researchgate.net/profile/Bruno-Cruz-25",
    ],
  },
  image: {
    path: "/static/og/og-default.png",
    width: 1200,
    height: 630,
    alt: "Architectural survey drawing of a house plan, the drawing used across cruz.rio.br",
  },
  // Authored artwork in public/static/icons/, listed here so the <head> links, the
  // manifest and the root /favicon.ico route all read the same set. `ico` is also
  // served from the site root, which is where crawlers and feed readers look first.
  icons: {
    ico: { path: "/static/icons/favicon.ico", sizes: "16x16 32x32" },
    png: [
      { path: "/static/icons/favicon-32x32.png", sizes: "32x32" },
      { path: "/static/icons/favicon-16x16.png", sizes: "16x16" },
    ],
    appleTouch: { path: "/static/icons/apple-touch-icon.png", sizes: "180x180" },
    // Referenced only from the manifest: the install icons Android and Chrome use.
    app: [
      { path: "/static/icons/android-chrome-192x192.png", sizes: "192x192" },
      { path: "/static/icons/android-chrome-512x512.png", sizes: "512x512" },
    ],
  },
  themeColor: {
    light: "#ffffff",
    dark: "#151515",
  },
  search: {
    // Public by design: IndexNow proves a submission came from this host by
    // fetching /<key>.txt, which src/pages/[indexNowKey].txt.js emits from here.
    // Set to null to stop publishing the key and skip the submission entirely.
    indexNowKey: "336c1b6fd6489e0290c0a6f107b11ec4",
    // One-time ownership tokens for the webmaster consoles, keyed by the exact
    // <meta name> each one requires. Prefer verifying by DNS TXT record where the
    // registrar allows it — that survives any change to the markup. A null token
    // emits no tag.
    verification: {
      "google-site-verification": null,
      "msvalidate.01": null,
    },
  },
};

// Absolute URL for a site-root-relative path. Every canonical, og:url, sitemap <loc>
// and og:image goes through here so the origin is never spelled out twice.
export function absoluteUrl(pathname = "/") {
  return new URL(pathname, `${url}/`).href;
}

// Titles read "<page> — <site>", except on the home page where that would stutter.
export function documentTitle(title) {
  if (!title || title === site.name) {
    return site.name;
  }
  return `${title} — ${site.name}`;
}
