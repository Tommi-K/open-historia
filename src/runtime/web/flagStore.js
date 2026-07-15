/*! Open Historia — web flag library store © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

// Browser port of server/flagStore.js. Backs /api/flags* in web mode so the editor's
// "My flags" shelf works identically on the website and the download.
//
// Kept in the existing `kv` store rather than a new object store on purpose: adding
// one means bumping idb.js DB_VERSION, and that upgrade blocks (and rejects) while
// another tab holds the old version open. A whole flag library is a few hundred KB
// — far too small to justify a schema migration for every existing player.
//
// Hash canonicalization must stay identical to server/flagStore.js (sha256 of the
// data URL), or the same flag dedupes on desktop and duplicates on the website.

import { kvGet, kvPut } from "./idb.js";

const KEY = "flags:library";

const readAll = async () => {
  const stored = await kvGet(KEY, null);
  return Array.isArray(stored?.flags) ? stored.flags : [];
};

const writeAll = (flags) => kvPut(KEY, { version: 1, flags });

const sha256Hex = async (str) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(str)));
  return Array.from(new Uint8Array(buf)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const slug = (raw, fallback = "flag") =>
  String(raw ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || fallback;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const listFlags = async () => readAll();

const createFlag = async (body = {}) => {
  const dataUrl = String(body.dataUrl || "");
  if (!dataUrl.startsWith("data:image/")) throw new Error("A flag must be an image data URL.");
  const flags = await readAll();
  const contentHash = await sha256Hex(dataUrl);
  const existing = flags.find((f) => f.contentHash === contentHash);
  if (existing) return existing;

  const base = slug(body.name || body.code);
  let id = base;
  for (let n = 2; flags.some((f) => f.id === id); n += 1) id = `${base}-${n}`;

  const flag = {
    id,
    name: String(body.name || body.code || "Flag").slice(0, 80),
    code: String(body.code || "").toUpperCase().slice(0, 12),
    author: String(body.author || "").slice(0, 80),
    dataUrl,
    contentHash,
    createdAt: new Date().toISOString(),
  };
  await writeAll([flag, ...flags]);
  return flag;
};

const deleteFlag = async (id) => {
  const flags = await readAll();
  await writeAll(flags.filter((f) => f.id !== String(id ?? "")));
  return { id, deleted: true };
};

// Router entry: /api/flags  and  /api/flags/:id
export const handleFlags = async ({ method, segments, body }) => {
  if (segments.length === 0 && method === "GET") return jsonResponse(await listFlags());
  if (segments.length === 0 && method === "POST") return jsonResponse(await createFlag(body ?? {}), 201);
  if (segments.length === 1 && method === "DELETE") return jsonResponse(await deleteFlag(segments[0]));
  return jsonResponse({ error: "Unsupported flag request." }, 404);
};
