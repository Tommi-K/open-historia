/*! Open Historia — embedded-server map-asset fetch © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

// First-run download of the large map binaries for the EMBEDDED server. Same
// release + checksums as the desktop scripts/fetch-map-assets.mjs, but every
// asset is routed into the writable OH_DATA_DIR instead of the read-only bundle:
//
//   server/data/<x>   -> <DATA_DIR>/<x>        (scenario geojson, etc.)
//   public/assets/<x> -> <DATA_DIR>/assets/<x> (regions/countries/cities pmtiles)
//
// See mobile/README-embedded-server.md § "Map data" — the server must serve
// /assets/*.pmtiles from <DATA_DIR>/assets for the tiles to reach the WebView.
// Best-effort and idempotent: skips a file that already matches (size, then
// sha256), never throws in a way that stops the server.

import { createHash } from "node:crypto";
import { readFile, writeFile, stat, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// Map a manifest path (root-relative, from map-assets.json) to its embedded
// location under the writable data dir.
const targetFor = (dataDir, assetPath) => {
  const normalized = assetPath.replace(/\\/g, "/");
  if (normalized.startsWith("server/data/")) {
    return path.join(dataDir, normalized.slice("server/data/".length));
  }
  if (normalized.startsWith("public/assets/")) {
    return path.join(dataDir, "assets", normalized.slice("public/assets/".length));
  }
  // Anything else: mirror it verbatim under the data dir so it never lands in
  // the read-only bundle.
  return path.join(dataDir, normalized);
};

export const fetchMapAssets = async (dataDir) => {
  if (typeof fetch !== "function") {
    console.warn("[embedded] this Node is too old for fetch(); skipping map download");
    return;
  }
  let manifest;
  try {
    // Bundled next to this file by the assembly script; falls back to the repo copy on desktop.
    const candidates = [path.join(here, "map-assets.json"), path.join(here, "..", "..", "scripts", "map-assets.json")];
    const found = await Promise.all(candidates.map((p) => readFile(p, "utf8").then((t) => ({ p, t }), () => null)));
    const hit = found.find(Boolean);
    if (!hit) throw new Error("map-assets.json not found");
    manifest = JSON.parse(hit.t);
  } catch (error) {
    console.warn(`[embedded] cannot read map manifest (${error.message}); skipping map download`);
    return;
  }

  const { owner, repo, release, assets = [] } = manifest;
  if (!owner || !repo || !release || !assets.length) {
    console.warn("[embedded] map manifest incomplete; skipping map download");
    return;
  }
  const base = `https://github.com/${owner}/${repo}/releases/download/${encodeURIComponent(release)}`;

  let downloaded = 0;
  let present = 0;
  let failed = 0;
  for (const asset of assets) {
    const dst = targetFor(dataDir, asset.path);
    try {
      const info = await stat(dst);
      if (info.size === asset.bytes && sha256(await readFile(dst)) === asset.sha256) { present += 1; continue; }
    } catch { /* missing — download */ }

    const url = `${base}/${asset.asset}`;
    const tmp = `${dst}.download`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (sha256(buf) !== asset.sha256) throw new Error("checksum mismatch");
      await mkdir(path.dirname(dst), { recursive: true });
      await writeFile(tmp, buf);
      await rename(tmp, dst);
      downloaded += 1;
    } catch (error) {
      console.warn(`[embedded] could not download ${asset.asset} (${error.message})`);
      await unlink(tmp).catch(() => {});
      failed += 1;
    }
  }
  console.log(`[embedded] map assets: ${downloaded} downloaded, ${present} current, ${failed} failed`);
};
