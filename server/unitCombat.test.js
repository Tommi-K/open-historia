import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRegionCaptureToWorld,
  resolveRegionCapture,
  resolveRegionTarget,
  selectRegionFeature,
} from "../src/Game/Map/regionCapture.js";

const army = {
  id: "army-1",
  ownerCode: "ATT",
  regionId: "DEF.1_1",
  status: "moving",
  strength: 300,
  type: "infantry",
};

const region = {
  id: "DEF.1_1",
  name: "Frontier",
  ownerCode: "DEF",
};

test("resolveRegionTarget uses live ownership before stale map feature ownership", () => {
  assert.deepEqual(
    resolveRegionTarget({
      ownershipOverrides: { "DEF.1_1": "ATT" },
      properties: {
        GID_0: "DEF",
        GID_1: "DEF.1_1",
        NAME_1: "Frontier",
      },
    }),
    {
      id: "DEF.1_1",
      name: "Frontier",
      ownerCode: "ATT",
    },
  );
});

test("resolveRegionTarget supports custom region feature properties", () => {
  assert.deepEqual(
    resolveRegionTarget({
      properties: { id: "reg_frontier", name: "Marches", owner: "DEF" },
    }),
    {
      id: "reg_frontier",
      name: "Marches",
      ownerCode: "DEF",
    },
  );
});

test("selectRegionFeature keeps mixed-map GADM regions clickable without exposing hidden Earth", () => {
  const hiddenStock = { layer: { id: "regions-fill" }, properties: { GID_1: "EARTH.1_1" } };
  const activeStock = { layer: { id: "regions-fill" }, properties: { GID_1: "MIXED.1_1" } };
  const drawn = { layer: { id: "custom-regions-fill" }, properties: { id: "reg_drawn" } };

  assert.equal(selectRegionFeature({
    customStockRegionIds: new Set(["MIXED.1_1"]),
    features: [hiddenStock, activeStock],
    hasDrawnGeometry: true,
  }), activeStock);
  assert.equal(selectRegionFeature({
    customStockRegionIds: new Set(),
    features: [hiddenStock, drawn],
    hasDrawnGeometry: true,
  }), drawn);
  assert.equal(selectRegionFeature({ features: [hiddenStock], hasDrawnGeometry: false }), hiddenStock);
});

test("resolveRegionCapture transfers an undefended enemy region to an occupying army", () => {
  assert.deepEqual(resolveRegionCapture({ unit: army, region, units: [army] }), {
    fromCode: "DEF",
    regionId: "DEF.1_1",
    regionName: "Frontier",
    toCode: "ATT",
  });
});

test("resolveRegionCapture lets an army claim unowned land", () => {
  assert.deepEqual(
    resolveRegionCapture({ unit: army, region: { ...region, ownerCode: "" }, units: [army] }),
    {
      fromCode: "",
      regionId: "DEF.1_1",
      regionName: "Frontier",
      toCode: "ATT",
    },
  );
});

test("resolveRegionCapture does not create a transfer for friendly territory", () => {
  assert.equal(
    resolveRegionCapture({ unit: army, region: { ...region, ownerCode: "ATT" }, units: [army] }),
    null,
  );
});

test("resolveRegionCapture requires a ready ground unit", () => {
  for (const ineligible of [
    { ...army, type: "air" },
    { ...army, type: "naval" },
    { ...army, status: "pending" },
    { ...army, strength: 0 },
  ]) {
    assert.equal(resolveRegionCapture({ unit: ineligible, region, units: [ineligible] }), null);
  }
});

test("resolveRegionCapture waits until hostile ground defenders are removed", () => {
  const defender = {
    id: "army-2",
    ownerCode: "DEF",
    regionId: region.id,
    status: "engaged",
    strength: 100,
    type: "garrison",
  };

  assert.equal(resolveRegionCapture({ unit: army, region, units: [army, defender] }), null);
  assert.notEqual(
    resolveRegionCapture({
      unit: army,
      region,
      units: [army, { ...defender, status: "defeated", strength: 0 }],
    }),
    null,
  );
});

test("resolveRegionCapture honors clicked defenders whose legacy records lack regionId", () => {
  const legacyDefender = {
    id: "legacy-defender",
    ownerCode: "DEF",
    regionId: "",
    status: "engaged",
    strength: 100,
    type: "infantry",
  };

  assert.equal(resolveRegionCapture({
    unit: army,
    region: { ...region, defendingUnitIds: [legacyDefender.id] },
    units: [army, legacyDefender],
  }), null);
});

test("applyRegionCaptureToWorld atomically preserves world state and changes only the occupied region", () => {
  const sourceWorld = {
    notes: "keep me",
    regionOwnershipOverrides: {
      "AAA.1_1": "AAA",
      "DEF.1_1": "DEF",
    },
    units: [army],
  };

  const result = applyRegionCaptureToWorld({
    world: sourceWorld,
    units: [army],
    unitId: army.id,
    region,
  });

  assert.equal(result.capture?.toCode, "ATT");
  assert.deepEqual(result.world.regionOwnershipOverrides, {
    "AAA.1_1": "AAA",
    "DEF.1_1": "ATT",
  });
  assert.equal(result.world.notes, "keep me");
  assert.equal(sourceWorld.regionOwnershipOverrides["DEF.1_1"], "DEF");
});
