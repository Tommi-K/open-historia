/*! Open Historia — assembles the embedded Node server for the Android app © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

// Populates mobile/nodejs-project/ with everything nodejs-mobile needs to run the
// real server in-process inside the APK:
//
//   mobile/nodejs-project/
//     main.js, fetchMapAssets.mjs   (committed entry — not touched here)
//     package.json                  (express only — the server's sole npm dep)
//     node_modules/                 (npm install express, run here)
//     server/                       (copied from ./server)
//     dist/                         (copied from ./dist — build it first)
//     public/lang/                  (server's built-in lang fallback)
//     map-assets.json               (release manifest for first-run map fetch)
//     seed/                         (default scenarios MINUS the heavy geojson/
//                                    pmtiles, which fetchMapAssets pulls at runtime)
//
// Run AFTER `vite build` (needs ./dist). Idempotent: wipes and rebuilds the
// copied dirs each time, leaving the committed main.js/fetchMapAssets.mjs alone.
//
// Deliberately excludes the ~200 MB map binaries — they can't ship in an APK and
// are downloaded on first run (see mobile/nodejs-project/fetchMapAssets.mjs).
import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "mobile", "nodejs-project");
const SKIP_INSTALL = process.argv.includes("--no-install");

const die = (msg) => { console.error(`build-mobile-server: ${msg}`); process.exit(1); };
if (!existsSync(path.join(ROOT, "server", "server.js"))) die("run from the repo root (server/server.js not found)");
if (!existsSync(path.join(ROOT, "dist", "index.html"))) die("dist/ is missing — run `vite build` first");

// Files fetched at runtime, never bundled (too big for an APK).
const HEAVY = /\.(pmtiles|geojson)$|cities-seed\.json$/i;
const copyLight = (src, dst) =>
  cpSync(src, dst, { recursive: true, filter: (from) => !(statSync(from).isFile() && HEAVY.test(from)) });

console.log("build-mobile-server: assembling", path.relative(ROOT, OUT));
for (const dir of ["server", "dist", "public", "seed", "node_modules"]) {
  rmSync(path.join(OUT, dir), { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

// 1. Server code + the built game. The built dist may include the heavy pmtiles
//    (vite copies public/ verbatim); strip them — they're fetched at runtime and
//    served from <DATA_DIR>/assets, not the bundle.
cpSync(path.join(ROOT, "server"), path.join(OUT, "server"), { recursive: true });
copyLight(path.join(ROOT, "dist"), path.join(OUT, "dist"));

// 2. The server's read-only lang fallback (public/lang). public/assets pmtiles
//    are intentionally NOT copied.
mkdirSync(path.join(OUT, "public"), { recursive: true });
if (existsSync(path.join(ROOT, "public", "lang"))) {
  cpSync(path.join(ROOT, "public", "lang"), path.join(OUT, "public", "lang"), { recursive: true });
}

// 3. Seed: default scenarios + manifests, minus the heavy map files.
mkdirSync(path.join(OUT, "seed"), { recursive: true });
const dataSrc = path.join(ROOT, "server", "data");
for (const entry of ["scenario-manifest.json", "game-manifest.json", "scenarios"]) {
  const from = path.join(dataSrc, entry);
  if (existsSync(from)) copyLight(from, path.join(OUT, "seed", entry));
}

// 4. Map manifest for the first-run fetch.
cpSync(path.join(ROOT, "scripts", "map-assets.json"), path.join(OUT, "map-assets.json"));

// 5. package.json — express is the server's only runtime npm dependency; mirror
//    the root's pinned version so the phone runs the same express as desktop.
const rootDeps = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).dependencies || {};
writeFileSync(path.join(OUT, "package.json"), JSON.stringify({
  name: "open-historia-embedded-server",
  private: true,
  type: "module",
  main: "main.js",
  dependencies: { express: rootDeps.express || "^5.1.0" },
}, null, 2) + "\n");

// 6. Install express into the project so the APK bundles node_modules.
if (!SKIP_INSTALL) {
  console.log("build-mobile-server: installing express into the node project...");
  execSync("npm install --omit=dev --no-audit --no-fund", { cwd: OUT, stdio: "inherit" });
}

console.log("build-mobile-server: done. mobile/nodejs-project/ is ready for `cap sync`.");
