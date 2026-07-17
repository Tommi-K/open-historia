/*! Open Historia — owner migration tests © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
// Run: npm test
//
// These assert against the REAL shipped scenarios rather than fixtures. The whole
// difficulty of this migration is that the eight shipped worlds disagree about
// what an owner token means — a fixture would only encode what I already believed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import {
  OWNER_SCHEMA,
  buildOwnerRenameMap,
  migrateGame,
  migrateRegions,
  migrateWorld,
  needsMigration,
  resolveOwnerName,
} from "./ownerMigration.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SCENARIOS = path.join(ROOT, "server", "data", "scenarios");
const read = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
};
const REGISTRY = read(path.join(ROOT, "server", "country-names.json"), {});
const has = (id) => fs.existsSync(path.join(SCENARIOS, id, "world.json"));

const ctxFor = (id) => {
  const base = path.join(SCENARIOS, id);
  const world = read(path.join(base, "world.json"), {});
  const game = read(path.join(base, "game.json"), {});
  const meta = read(path.join(base, "scenario.json"), {});
  // A scenario with no map of its own serves the default's — same as the store.
  const fc = read(path.join(base, "regions.geojson"), null)
    ?? read(path.join(SCENARIOS, "default", "regions.geojson"), { features: [] });
  return {
    world, game, fc,
    ctx: {
      polityOverrides: world.polityOverrides,
      countryNameOverrides: meta.countryNameOverrides,
      registry: REGISTRY,
      features: fc.features,
      ownershipOverrides: world.regionOwnershipOverrides,
      ownerCodes: world.ownerCodes,
      units: world.units,
      countryTags: world.countryTags,
      internationalReputation: world.internationalReputation,
      gameCountry: game.country,
    },
  };
};

test("default: the disputed territories merge into their claimants", (t) => {
  if (!has("default")) return t.skip("default scenario not built");
  const { ctx, fc } = ctxFor("default");

  // The accepted merge, stated as the numbers rather than as a rule: 240 distinct
  // owner codes collapse to 231 names because 9 Z0x placeholders join India,
  // China and Pakistan.
  const owners = new Set(fc.features.map((f) => f.properties?.owner).filter(Boolean));
  const names = new Set([...owners].map((o) => resolveOwnerName(o, ctx)));
  assert.equal(owners.size, 240);
  assert.equal(names.size, 231);

  assert.equal(resolveOwnerName("Z01", ctx), "India");     // Jammu and Kashmir
  assert.equal(resolveOwnerName("Z06", ctx), "Pakistan");  // Azad Kashmir
  assert.equal(resolveOwnerName("Z02", ctx), "China");     // Aksai Chin
  assert.equal(resolveOwnerName("RUS", ctx), "Russia");
});

test("rule 1 beats rule 3: a scenario's own polity wins over the registry", (t) => {
  if (!has("roman-117")) return t.skip("roman-117 not built");
  const { ctx } = ctxFor("roman-117");
  // ROM is not a GADM code, and roman-117's ROM spans 36 modern countries — so
  // consensus MUST NOT fire here. This is the case that kills the obvious
  // "self-migrate from region.country" design.
  assert.equal(resolveOwnerName("ROM", ctx), "Roman Empire");
});

test("the name !== token guard: degenerate Z0x polities must not name themselves", (t) => {
  if (!has("default")) return t.skip("default scenario not built");
  const { world, ctx } = ctxFor("default");
  // default/world.json really does carry {"Z01": {code:"Z01", name:"Z01"}}. Without
  // the guard, rule 1 returns "Z01" and the merge above silently dies.
  const degenerate = Object.entries(world.polityOverrides ?? {})
    .filter(([code, p]) => String(p?.name ?? "") === code);
  assert.ok(degenerate.length > 0, "expected the shipped degenerate Z0x entries");
  for (const [code] of degenerate) {
    assert.notEqual(resolveOwnerName(code, ctx), code, `${code} resolved to itself`);
  }
});

test("rule 2 is the only thing that saves a legacy label", (t) => {
  if (!has("wwii-1939")) return t.skip("wwii-1939 not built");
  const { ctx } = ctxFor("wwii-1939");
  // "Siam" exists nowhere but countryNameOverrides in a pre-rebuild save.
  assert.equal(resolveOwnerName("THA", ctx), "Siam");
});

test("rule 3 beats rule 4: the registry is more correct than region.country", (t) => {
  if (!has("default")) return t.skip("default scenario not built");
  const { ctx } = ctxFor("default");
  // The seed says "México" / "Côte d'Ivoire" and truncates UMI at 32 chars. The
  // registry is the normalised form the rest of the code matches against.
  assert.equal(resolveOwnerName("MEX", ctx), "Mexico");
  assert.equal(resolveOwnerName("CIV", ctx), "Cote d'Ivoire");
  assert.equal(resolveOwnerName("UMI", ctx), "United States Minor Outlying Islands");
});

test("rule 5: an FMG world's polities are already their own names", (t) => {
  if (!has("modern-day-copy")) return t.skip("modern-day-copy not present");
  const { ctx, game } = ctxFor("modern-day-copy");
  const played = String(game.country ?? "").trim();
  assert.ok(played);
  assert.equal(resolveOwnerName(played, ctx), played);
});

test("every shipped scenario resolves its played country", (t) => {
  const ids = fs.existsSync(SCENARIOS)
    ? fs.readdirSync(SCENARIOS).filter((d) => has(d))
    : [];
  if (!ids.length) return t.skip("no scenarios built");
  for (const id of ids) {
    const { ctx, game } = ctxFor(id);
    const played = String(game.country ?? "").trim();
    if (!played) continue;
    const name = resolveOwnerName(played, ctx);
    assert.ok(name, `${id}: game.country did not resolve`);
    // The player must own something: the resolved name has to be an owner the
    // world actually knows, or they start the game owning nothing.
    const map = buildOwnerRenameMap(ctx);
    assert.equal(map.get(played), name, `${id}: rename map disagrees with the resolver`);
  }
});

test("migration is idempotent and stamps the marker", (t) => {
  const ids = ["default", "roman-117", "wwii-1939"].filter(has);
  if (!ids.length) return t.skip("no scenarios built");
  for (const id of ids) {
    const { world, game, fc, ctx } = ctxFor(id);
    assert.ok(needsMigration(world), `${id}: fixture should be pre-migration`);

    const map = buildOwnerRenameMap(ctx);
    const once = {
      world: migrateWorld(world, map, () => {}),
      game: migrateGame(game, map),
      regions: migrateRegions(fc, map),
    };
    assert.equal(once.world.ownerSchema, OWNER_SCHEMA);
    assert.equal(needsMigration(once.world), false, `${id}: marker not honoured`);

    // Re-resolving a migrated record must be a fixpoint — the marker is the real
    // guard, but a non-idempotent migrator would corrupt on any double-hook.
    const ctx2 = {
      ...ctx,
      polityOverrides: once.world.polityOverrides,
      countryNameOverrides: undefined,
      features: once.regions.features,
      ownershipOverrides: once.world.regionOwnershipOverrides,
      gameCountry: once.game.country,
    };
    const map2 = buildOwnerRenameMap(ctx2);
    const twice = {
      world: migrateWorld(once.world, map2, () => {}),
      game: migrateGame(once.game, map2),
      regions: migrateRegions(once.regions, map2),
    };
    assert.deepEqual(twice, once, `${id}: migration is not idempotent`);
  }
});

test("regions keep id and gid0, lose country, and gain a named owner", (t) => {
  if (!has("default")) return t.skip("default scenario not built");
  const { fc, ctx } = ctxFor("default");
  const map = buildOwnerRenameMap(ctx);
  const out = migrateRegions(fc, map);
  const sample = out.features.find((f) => f.properties?.owner);
  assert.equal(sample.properties.owner, "Russia");
  assert.ok(sample.properties.id, "region id must survive — it is not owner-space");
  assert.ok(sample.properties.gid0, "gid0 must survive as GADM provenance");
  assert.ok(!("country" in sample.properties), "country is duplicate state once owner is the name");
});

test("collisions resolve to the real country, not the disputed placeholder", () => {
  // IND and Z01 both become "India". India must keep India's colour.
  const world = {
    polityOverrides: {},
    // deliberately ordered so Z01 would win a naive last-write-wins
    regionOwnershipOverrides: {},
  };
  const map = buildOwnerRenameMap({ registry: { IND: "India", Z01: "India" }, colors: { Z01: [1, 1, 1], IND: [2, 2, 2] } });
  const migrated = migrateWorld({ ...world, countryTags: { Z01: ["disputed"], IND: ["real"] } }, map, () => {});
  assert.deepEqual(migrated.countryTags, { India: ["real"] });
});
