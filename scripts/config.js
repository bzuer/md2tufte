// Shell view of config.ini, so scripts/manage.sh reads the settings through the
// same parser the site does: eval "$(node scripts/config.js)".

import { site } from "../src/lib/config.js";
import { distDir } from "../src/lib/paths.js";

const values = {
  SITE_URL: site.url,
  SITE_HOST: site.host,
  PORT: site.server.port,
  NGINX_CONF: site.server.nginxConf,
  DIST: distDir,
};

// Single-quoted, because the caller eval's this. JSON quoting is not shell
// quoting: a $, a backtick or a backslash in config.ini would survive it and run
// as code. Inside single quotes nothing is special but the quote itself.
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

for (const [name, value] of Object.entries(values)) {
  console.log(`${name}=${shellQuote(value)}`);
}
