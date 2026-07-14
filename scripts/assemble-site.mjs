/*! Open Historia — combined site assembler © 2026 Nicholas Krol, MIT. */
// Builds dist-site/: the marketing landing page (site/) at the root, and the web
// game (dist-web/, built with `--base /play/`) under /play/. Deploy dist-site to
// Cloudflare Pages so openhistoria.com serves the landing page and its "Play"
// button opens the game (connect + sign-in screen) at /play/.
import { rmSync, mkdirSync, cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteDir = path.join(root, "site");       // landing page source (index.html, _redirects)
const gameDir = path.join(root, "dist-web");   // web game, built with base /play/
const outDir = path.join(root, "dist-site");

if (!existsSync(path.join(gameDir, "index.html"))) {
  console.error("dist-web/ is missing — build the game first: vite build --mode web --base /play/ --outDir dist-web");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(siteDir, outDir, { recursive: true });                    // landing page + _redirects at /
cpSync(gameDir, path.join(outDir, "play"), { recursive: true }); // game at /play/
console.log("Assembled dist-site/: landing page at /, game at /play/.");
