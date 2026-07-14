/*! Open Historia — web-mode encrypted sync engine © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
// Reconciles the browser's games + scenarios (and their catalog manifests) with
// the registry Worker's encrypted blob store. Everything is AES-256-GCM encrypted
// client-side (account.js) before it leaves the device; the server sees only
// ciphertext. Uses a full-scan model (compare local SHA-256 vs the last synced
// version) so no write can be missed — no fragile idb write hooks. Web build only.

import { idbGetAll, idbPut, idbDelete, kvGet, kvPut, STORES } from "./idb.js";
import {
  accountConfigured, isSignedIn, getDek, recordFingerprint, encryptRecord, decryptRecord,
  syncManifest, syncGetBlob, syncPutBlob, syncDeleteBlob,
} from "./account.js";

// v1 scope: games + scenarios (the "save my playthrough" need). Map-editor docs
// and basemaps (large) wait for R2. Each record → one blob; catalog manifests too.
const SYNCED_STORES = [
  { store: STORES.games, prefix: "games:" },
  { store: STORES.scenarios, prefix: "scenarios:" },
];
const KV_MANIFESTS = ["game-manifest", "scenario-manifest"];
const VERSIONS_KEY = "sync:versions"; // { blob_id: { version, sha?, deleted? } } — device-local, never synced

const blobIdParts = (blobId) => {
  const i = blobId.indexOf(":");
  return { kind: blobId.slice(0, i), id: blobId.slice(i + 1) };
};

// Read every syncable local record as blob_id → { rec, sha }.
const collectLocal = async () => {
  const local = new Map();
  for (const { store, prefix } of SYNCED_STORES) {
    for (const rec of await idbGetAll(store)) {
      local.set(prefix + rec.id, { rec, sha: await recordFingerprint(rec) });
    }
  }
  for (const name of KV_MANIFESTS) {
    const value = await kvGet(name, undefined);
    if (value !== undefined) {
      const rec = { key: name, value };
      local.set(`kv:${name}`, { rec, sha: await recordFingerprint(rec) });
    }
  }
  return local;
};

const applyBlob = async (blobId, rec) => {
  const { kind } = blobIdParts(blobId);
  if (kind === "games") await idbPut(STORES.games, rec);
  else if (kind === "scenarios") await idbPut(STORES.scenarios, rec);
  else if (kind === "kv") await kvPut(rec.key, rec.value);
};

const deleteLocal = async (blobId) => {
  const { kind, id } = blobIdParts(blobId);
  if (kind === "games") await idbDelete(STORES.games, id);
  else if (kind === "scenarios") await idbDelete(STORES.scenarios, id);
  // kv manifests are never deleted (they always exist) — ignore.
};

// Pull server changes newer than what we last synced.
const pull = async (versions) => {
  for (const s of await syncManifest()) {
    const known = versions[s.blob_id];
    if (known && s.version <= known.version) continue;
    if (s.deleted) {
      await deleteLocal(s.blob_id);
      versions[s.blob_id] = { version: s.version, deleted: true };
      continue;
    }
    const blob = await syncGetBlob(s.blob_id);
    if (!blob || blob.deleted) { versions[s.blob_id] = { version: s.version, deleted: true }; continue; }
    await applyBlob(s.blob_id, await decryptRecord(blob.ciphertext));
    versions[s.blob_id] = { version: s.version, sha: blob.sha256 };
  }
};

// Push local changes; last-writer-wins on conflict (take the server copy).
const push = async (versions) => {
  const local = await collectLocal();
  // upserts (new or locally-changed records)
  for (const [blobId, { rec, sha }] of local) {
    const known = versions[blobId];
    if (known && !known.deleted && known.sha === sha) continue;
    const { ciphertext, sha256 } = await encryptRecord(rec);
    const res = await syncPutBlob(blobId, ciphertext, sha256, known?.version || 0);
    if (res.status === 200) versions[blobId] = { version: res.version, sha: sha256 };
    else if (res.status === 409 && res.current) {
      if (res.current.deleted) { await deleteLocal(blobId); versions[blobId] = { version: res.current.version, deleted: true }; }
      else { await applyBlob(blobId, await decryptRecord(res.current.ciphertext)); versions[blobId] = { version: res.current.version, sha: res.current.sha256 }; }
    }
    // 413 (too large for D1) — leave unsynced; enable R2 to sync large items.
  }
  // tombstones: records we synced before that are gone locally now
  for (const [blobId, known] of Object.entries(versions)) {
    if (known.deleted || local.has(blobId) || blobId.startsWith("kv:")) continue;
    const res = await syncDeleteBlob(blobId, known.version);
    if (res.status === 200) versions[blobId] = { version: res.version, deleted: true };
    else if (res.status === 409 && res.current) {
      if (res.current.deleted) versions[blobId] = { version: res.current.version, deleted: true };
      else { await applyBlob(blobId, await decryptRecord(res.current.ciphertext)); versions[blobId] = { version: res.current.version, sha: res.current.sha256 }; }
    }
  }
};

let running = false;
export const syncNow = async () => {
  if (running || !accountConfigured() || !(await isSignedIn()) || !(await getDek())) return;
  running = true;
  window.dispatchEvent(new CustomEvent("oh:sync", { detail: { state: "syncing" } }));
  try {
    const versions = await kvGet(VERSIONS_KEY, {});
    await pull(versions);
    await push(versions);
    await kvPut(VERSIONS_KEY, versions);
    window.dispatchEvent(new CustomEvent("oh:sync", { detail: { state: "ok", at: Date.now() } }));
  } catch (error) {
    console.warn("[sync]", error.message);
    window.dispatchEvent(new CustomEvent("oh:sync", { detail: { state: "error", error: error.message } }));
  } finally {
    running = false;
  }
};

let timer = null;
export const startSync = async () => {
  if (!accountConfigured()) return;
  await syncNow();
  clearInterval(timer);
  timer = setInterval(syncNow, 20000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") syncNow(); });
};

export const stopSync = () => { clearInterval(timer); timer = null; };
