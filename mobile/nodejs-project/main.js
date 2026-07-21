/*! Open Historia — embedded server entry for the Android app © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

// nodejs-mobile runs THIS file inside the app. It turns the phone into its own
// Open Historia server so the app needs no Termux and no separate machine:
//
//   1. Pick a WRITABLE data dir. nodejs-mobile extracts this project to a
//      writable location, so a folder next to this file is writable — the
//      bundled server/data would be read-only. The native launcher may override
//      it with OH_DATA_DIR (e.g. the app's Documents dir).
//   2. First run: seed the writable dir from the bundled ./seed snapshot
//      (default scenarios + manifests) so the library isn't empty.
//   3. Best-effort: pull the large map binaries from the GitHub Release into the
//      data dir (see fetchMapAssets) — never blocks the server from starting.
//   4. Start the real server (server/server.js) bound to loopback. The WebView
//      then loads http://127.0.0.1:<port> and the game runs same-origin.
//
// Everything here is plain Node + fs, so it runs identically on a desktop for
// testing (`node mobile/nodejs-project/main.js`) and inside nodejs-mobile.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// 1. Writable data dir. server.js + every store read OH_DATA_DIR (see
//    server/dataDir.js); set it before importing the server.
const DATA_DIR = process.env.OH_DATA_DIR
  ? path.resolve(process.env.OH_DATA_DIR)
  : path.join(here, "runtime-data");
process.env.OH_DATA_DIR = DATA_DIR;
process.env.PORT = process.env.PORT || "3000";
// The WebView loads http://127.0.0.1 same-origin, so cross-origin writes stay
// off (the loopback bind + same-origin is the whole security model here).
fs.mkdirSync(DATA_DIR, { recursive: true });

// 2. First-run seed. "Empty" = no scenario manifest yet. Copy the bundled
//    snapshot so the player has the default scenarios immediately. The heavy
//    map binaries are NOT in the snapshot (they are fetched in step 3), so this
//    stays small enough to ship inside the APK.
const seedDir = path.join(here, "seed");
const alreadySeeded = fs.existsSync(path.join(DATA_DIR, "scenario-manifest.json"));
if (!alreadySeeded && fs.existsSync(seedDir)) {
  try {
    fs.cpSync(seedDir, DATA_DIR, { recursive: true });
    console.log(`[embedded] seeded default data into ${DATA_DIR}`);
  } catch (error) {
    console.warn(`[embedded] seed failed (${error.message}); starting with an empty library`);
  }
}

// 3. Map assets (best-effort, never fatal). The ~200 MB of pmtiles/geojson can't
//    ship in the APK, so they download from the release on first run. Reused
//    from scripts/fetch-map-assets.mjs; see ./fetchMapAssets.mjs for the
//    OH_DATA_DIR-aware path mapping. Runs in the background — the server starts
//    immediately and the map fills in as tiles arrive.
try {
  const { fetchMapAssets } = await import("./fetchMapAssets.mjs");
  fetchMapAssets(DATA_DIR).catch((error) =>
    console.warn(`[embedded] map-asset fetch failed (${error.message}); the map may be blank until retried`),
  );
} catch (error) {
  console.warn(`[embedded] map-asset fetcher unavailable (${error.message})`);
}

// 4. Start the real server. It reads OH_DATA_DIR/PORT from the env set above.
console.log(`[embedded] starting Open Historia server on 127.0.0.1:${process.env.PORT} (data: ${DATA_DIR})`);
await import("./server/server.js");
