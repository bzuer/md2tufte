// Single source of truth for every site-wide metadata value. Nothing that ends up
// in a <head>, a sitemap, or robots.txt is written down anywhere else.

const url = "https://cruz.rio.br";

export const site = {
  url,
  name: "Bruno Cruz",
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
  themeColor: {
    light: "#ffffff",
    dark: "#151515",
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
