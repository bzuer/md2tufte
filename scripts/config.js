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

for (const [name, value] of Object.entries(values)) {
  console.log(`${name}=${JSON.stringify(String(value))}`);
}
