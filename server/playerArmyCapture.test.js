import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeUnitEntry } from "../src/runtime/gameState.js";
import { resolveClash } from "../src/Game/Map/unitCombat.js";
import {
  applyCombatResultToWorld,
  applyUnitMovementToWorld,
  buildPlayerDeploymentInput,
} from "../src/Game/Map/unitWorldMutations.js";

const combatRegion = { id: "DEF.1_1", name: "Frontier", ownerCode: "DEF" };
const attacker = {
  id: "attacker",
  lat: 47.5,
  lng: 19.0,
  name: "1st Army",
  ownerCode: "ATT",
  regionId: "ATT.1_1",
  status: "idle",
  strength: 500,
  type: "infantry",
};
const defender = {
  id: "defender",
  lat: 47.6,
  lng: 19.1,
  name: "Frontier Garrison",
  ownerCode: "DEF",
  regionId: combatRegion.id,
  status: "idle",
  strength: 100,
  type: "garrison",
};

test("player deployments enter the order of battle immediately", () => {
  const input = buildPlayerDeploymentInput({
    lat: 47.5,
    lng: 19.0,
    name: "1st Army",
    ownerCode: "ATT",
    region: { id: "ATT.1_1", name: "Home" },
    strength: 500,
    type: "infantry",
  });

  assert.deepEqual(input, {
    lat: 47.5,
    lng: 19.0,
    name: "1st Army",
    ownerCode: "ATT",
    regionId: "ATT.1_1",
    source: "player",
    status: "idle",
    strength: 500,
    type: "infantry",
  });
});

test("legacy pending player deployments are activated when loaded", () => {
  const unit = normalizeUnitEntry({
    id: "legacy-player-army",
    lat: 47.5,
    lng: 19.0,
    ownerCode: "ATT",
    source: "player",
    status: "pending",
    strength: 500,
    type: "infantry",
  });

  assert.equal(unit.status, "idle");
});

test("moving an active player army into an undefended enemy region captures it", () => {
  const unit = {
    id: "army-1",
    lat: 47.5,
    lng: 19.0,
    name: "1st Army",
    ownerCode: "ATT",
    regionId: "ATT.1_1",
    status: "idle",
    strength: 500,
    type: "infantry",
  };
  const sourceWorld = {
    notes: "preserve me",
    regionOwnershipOverrides: { "DEF.1_1": "DEF" },
    units: [unit],
  };

  const result = applyUnitMovementToWorld({
    lat: 47.6,
    lng: 19.1,
    targetRegion: { id: "DEF.1_1", name: "Frontier", ownerCode: "DEF" },
    timestamp: "2026-07-16T00:00:00.000Z",
    unitId: unit.id,
    world: sourceWorld,
  });

  assert.deepEqual(result.capture, {
    fromCode: "DEF",
    regionId: "DEF.1_1",
    regionName: "Frontier",
    toCode: "ATT",
  });
  assert.equal(result.world.regionOwnershipOverrides["DEF.1_1"], "ATT");
  assert.equal(result.world.notes, "preserve me");
  assert.deepEqual(result.world.units[0], {
    ...unit,
    lat: 47.6,
    lng: 19.1,
    regionId: "DEF.1_1",
    status: "moving",
    updatedAt: "2026-07-16T00:00:00.000Z",
  });
  assert.equal(sourceWorld.regionOwnershipOverrides["DEF.1_1"], "DEF");
});

test("pending scenario units cannot move or capture", () => {
  const pending = { ...attacker, id: "pending", source: "scenario", status: "pending" };
  const world = {
    regionOwnershipOverrides: { [combatRegion.id]: "DEF" },
    units: [pending],
  };
  const result = applyUnitMovementToWorld({
    lat: defender.lat,
    lng: defender.lng,
    targetRegion: combatRegion,
    unitId: pending.id,
    world,
  });

  assert.equal(result.capture, null);
  assert.equal(result.world, world);
  assert.equal(result.world.regionOwnershipOverrides[combatRegion.id], "DEF");
});

test("a surviving ground attacker captures after winning an ordinary battle", () => {
  const combat = resolveClash(attacker, defender, 1);
  assert.equal(combat.attackerWins, true);
  assert.ok(combat.defenderStrength > 0, "the casualty calculation should leave routed survivors");

  const result = applyCombatResultToWorld({
    attackerId: attacker.id,
    defenderId: defender.id,
    destinationRegion: combatRegion,
    result: combat,
    timestamp: "2026-07-16T00:00:00.000Z",
    world: {
      notes: "preserve me",
      regionOwnershipOverrides: { [combatRegion.id]: "DEF" },
      units: [attacker, defender],
    },
  });

  assert.equal(result.capture?.toCode, "ATT");
  assert.equal(result.world.regionOwnershipOverrides[combatRegion.id], "ATT");
  assert.equal(result.world.notes, "preserve me");
  assert.equal(result.world.units.some((unit) => unit.id === defender.id), false);
  assert.deepEqual(
    result.world.units.find((unit) => unit.id === attacker.id),
    {
      ...attacker,
      lat: defender.lat,
      lng: defender.lng,
      regionId: combatRegion.id,
      status: "engaged",
      strength: combat.attackerStrength,
      updatedAt: "2026-07-16T00:00:00.000Z",
    },
  );
});

test("another hostile ground defender prevents ownership transfer after a win", () => {
  const reserve = { ...defender, id: "reserve", name: "Reserve", strength: 80 };
  const combat = resolveClash(attacker, defender, 1);
  const result = applyCombatResultToWorld({
    attackerId: attacker.id,
    defenderId: defender.id,
    destinationRegion: combatRegion,
    result: combat,
    world: {
      regionOwnershipOverrides: { [combatRegion.id]: "DEF" },
      units: [attacker, defender, reserve],
    },
  });

  assert.equal(result.capture, null);
  assert.equal(result.world.regionOwnershipOverrides[combatRegion.id], "DEF");
  assert.ok(result.world.units.some((unit) => unit.id === reserve.id));
});

test("a losing attack does not move the attacker or transfer ownership", () => {
  const weakAttacker = { ...attacker, strength: 25 };
  const strongDefender = { ...defender, strength: 900 };
  const combat = resolveClash(weakAttacker, strongDefender, 1);
  assert.equal(combat.attackerWins, false);

  const result = applyCombatResultToWorld({
    attackerId: weakAttacker.id,
    defenderId: strongDefender.id,
    destinationRegion: combatRegion,
    result: combat,
    world: {
      regionOwnershipOverrides: { [combatRegion.id]: "DEF" },
      units: [weakAttacker, strongDefender],
    },
  });

  const savedAttacker = result.world.units.find((unit) => unit.id === weakAttacker.id);
  assert.equal(result.capture, null);
  assert.equal(result.world.regionOwnershipOverrides[combatRegion.id], "DEF");
  assert.equal(savedAttacker.lng, weakAttacker.lng);
  assert.equal(savedAttacker.lat, weakAttacker.lat);
  assert.equal(savedAttacker.regionId, weakAttacker.regionId);
});

test("air and naval victories cannot capture land", () => {
  for (const type of ["air", "naval"]) {
    const specialist = { ...attacker, id: `${type}-attacker`, type, strength: 1000 };
    const combat = resolveClash(specialist, defender, 1);
    assert.equal(combat.attackerWins, true);

    const result = applyCombatResultToWorld({
      attackerId: specialist.id,
      defenderId: defender.id,
      destinationRegion: combatRegion,
      result: combat,
      world: {
        regionOwnershipOverrides: { [combatRegion.id]: "DEF" },
        units: [specialist, defender],
      },
    });

    assert.equal(result.capture, null);
    assert.equal(result.world.regionOwnershipOverrides[combatRegion.id], "DEF");
  }
});

test("a battle without an exact region id cannot invent a capture", () => {
  const combat = resolveClash(attacker, defender, 1);
  const result = applyCombatResultToWorld({
    attackerId: attacker.id,
    defenderId: defender.id,
    destinationRegion: null,
    result: combat,
    world: { regionOwnershipOverrides: {}, units: [attacker, defender] },
  });

  assert.equal(result.capture, null);
  assert.deepEqual(result.world.regionOwnershipOverrides, {});
});
