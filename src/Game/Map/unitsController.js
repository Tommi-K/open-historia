/*! Open Historia — unit orders & deployment controller © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
// Shared troop interaction state + mutations.
//
// Holds the current unit list in memory (refreshed from world.json every 5s so
// AI-spawned/moved units appear) and applies player mutations immediately for
// snappy feedback, persisting them to world.json. A tiny pub/sub lets the map
// layer, the selection popup and the Forces panel re-render on change.
//
// Player deploy is purely local (you place your own pieces). Move and attack
// write immediately AND queue a machine-readable order (as an action) so the AI
// honors/contests them on the next time-jump. Combat uses the seeded resolver
// in unitCombat.js for instant feedback; the AI reconciles fronts on the jump.

import {
  readWorldState,
  writeWorldState,
  readGameData,
  readActionsState,
  writeActionsState,
  normalizeUnitEntry,
} from "../../runtime/gameState.js";
import { resolveClash, distanceKm, engagementRangeKm, moveLeashKm } from "./unitCombat.js";
import { applyRegionCaptureToWorld } from "./regionCapture.js";

let units = [];
let playerCode = "";
let round = 1;
let gameDate = "";
let allowedUnitTypes = null; // null = all types allowed; else the scenario's whitelist
let interactionMode = { kind: "idle" }; // idle | deploy | move | attack
let pollTimer = null;
let pendingCommits = 0; // suppress poll overwrite while queued mutations drain
let commitQueue = Promise.resolve();

const listeners = new Set();
const emit = () => {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (error) {
      console.error("units listener failed:", error);
    }
  }
};

export const subscribeUnits = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getUnits = () => units;
export const getUnitById = (id) => units.find((unit) => unit.id === id) ?? null;
export const getPlayerCode = () => playerCode;
// The scenario's allowed deployable troop types, or null when unrestricted.
export const getAllowedUnitTypes = () => allowedUnitTypes;
export const getInteractionMode = () => interactionMode;
export const setInteractionMode = (next) => {
  interactionMode = next && next.kind ? next : { kind: "idle" };
  emit();
};
export const clearInteractionMode = () => setInteractionMode({ kind: "idle" });

const refresh = async () => {
  if (pendingCommits > 0) return;
  try {
    const [world, game] = await Promise.all([
      readWorldState({ force: true }),
      readGameData({ force: true }),
    ]);
    units = world.units ?? [];
    playerCode = game.country ?? "";
    round = game.round ?? 1;
    gameDate = game.gameDate || game.startDate || "";
    allowedUnitTypes = Array.isArray(world.allowedUnitTypes) && world.allowedUnitTypes.length
      ? world.allowedUnitTypes
      : null;
    emit();
  } catch (error) {
    console.error("Failed to refresh units:", error);
  }
};

export const startUnitsSync = () => {
  if (pollTimer) return () => {};
  refresh();
  pollTimer = setInterval(refresh, 5000);
  return () => {
    clearInterval(pollTimer);
    pollTimer = null;
  };
};

// Read-modify-write the complete world once. Captures use this seam so unit
// movement and border ownership are persisted together instead of competing writes.
const commitWorld = (mutator) => {
  pendingCommits += 1;
  const operation = commitQueue.then(async () => {
    try {
      const world = await readWorldState({ force: true });
      const nextWorld = mutator(world) ?? world;
      const saved = await writeWorldState(nextWorld);
      units = saved.units ?? nextWorld.units ?? [];
      emit();
      return saved;
    } catch (error) {
      console.error("Failed to commit world unit state:", error);
      return null;
    } finally {
      pendingCommits -= 1;
    }
  });
  // Keep later local mutations ordered even when one write fails.
  commitQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

const commit = async (mutator) => {
  const saved = await commitWorld((world) => ({
    ...world,
    units: mutator(world.units ?? []),
  }));
  return saved?.units ?? null;
};

const queueOrder = async (text) => {
  try {
    const actions = await readActionsState({ force: true });
    actions.push({
      kind: "action",
      source: "order",
      status: "planned",
      text,
      title: text.length > 60 ? `${text.slice(0, 57)}...` : text,
    });
    await writeActionsState(actions);
  } catch (error) {
    console.error("Failed to queue order:", error);
  }
};

export const deployUnit = async ({ type, strength, name, lng, lat, region = null }) => {
  if (!playerCode) await refresh();
  // Deploy as PENDING (rendered translucent): the player states an intent, and the
  // AI confirms, relocates or rejects it on the next time-jump.
  const saved = await commit((list) => {
    const unit = normalizeUnitEntry({
      type,
      strength,
      name,
      lng,
      lat,
      regionId: region?.id,
      ownerCode: playerCode || "PLAYER",
      source: "player",
      status: "pending",
    });
    return unit ? [...list, unit] : list;
  });
  if (!saved) return null;
  await queueOrder(
    `Deploy request: ${name || type} (${type}, strength ${strength}, owner ${playerCode || "PLAYER"}) at ` +
      `lat ${lat.toFixed(2)}, lng ${lng.toFixed(2)}. Currently pending — confirm it into the order of battle, ` +
      `reposition it, or reject it as the front and logistics allow.` +
      `${region?.id ? ` Intended region: ${region.name || region.id} (exact id ${region.id}).` : ""}`,
  );
  return saved;
};

export const moveUnitTo = async (unitId, lng, lat, targetRegion = null) => {
  const unit = getUnitById(unitId);
  if (!unit) return { resolved: false };

  const distance = distanceKm(unit, { lng, lat });
  const leash = moveLeashKm(unit.type, gameDate);

  // Beyond the era/type leash the unit does NOT teleport: it stays put with a
  // long-range order the AI advances (or rejects) realistically over turns.
  if (distance > leash) {
    const saved = await commit((list) =>
      list.map((u) =>
        u.id === unitId ? { ...u, status: "moving", updatedAt: new Date().toISOString() } : u,
      ),
    );
    if (!saved) return { resolved: false, distance, leash, saveFailed: true };
    await queueOrder(
      `Long-range movement order: ${unit.name} (${unit.type}, id ${unit.id}, owner ${unit.ownerCode}) is ordered to ` +
        `lat ${lat.toFixed(2)}, lng ${lng.toFixed(2)} — about ${Math.round(distance)} km away, beyond a single ` +
        `${unit.type} move in this era (~${leash} km). Advance it realistically across turns given the era, terrain ` +
        `and transport available, or reject the order with an event explaining why it is infeasible.` +
        `${targetRegion?.id ? ` Target region: ${targetRegion.name || targetRegion.id} (exact id ${targetRegion.id}); no local capture has occurred.` : ""}`,
    );
    return { resolved: false, distance, leash };
  }

  let capture = null;
  const saved = await commitWorld((world) => {
    const timestamp = new Date().toISOString();
    const nextUnits = (world.units ?? []).map((currentUnit) =>
      currentUnit.id === unitId
        ? {
            ...currentUnit,
            lng,
            lat,
            regionId: targetRegion?.id || currentUnit.regionId,
            status: currentUnit.status === "pending" ? "pending" : "moving",
            updatedAt: timestamp,
          }
        : currentUnit,
    );
    const applied = applyRegionCaptureToWorld({
      world,
      units: nextUnits,
      unitId,
      region: targetRegion,
    });
    capture = applied.capture;
    return applied.world;
  });
  if (!saved) {
    capture = null;
    return { resolved: false, distance, leash, saveFailed: true };
  }
  await queueOrder(
    `Move ${unit.name} (${unit.type}, id ${unit.id}, owner ${unit.ownerCode}) to coordinates lat ${lat.toFixed(2)}, lng ${lng.toFixed(2)}.` +
      `${targetRegion?.id ? ` Destination region: ${targetRegion.name || targetRegion.id} (exact id ${targetRegion.id}).` : ""}` +
      `${capture
        ? ` The army now occupies it and local ownership already changed from ${capture.fromCode || "unclaimed"} to ${capture.toCode}; do not repeat that transfer unless control changes again.`
        : " No immediate region ownership change was made."}`,
  );
  return { resolved: true, distance, leash, captured: Boolean(capture), capture };
};

export const attackWith = async (attackerId, targetId, targetRegion = null) => {
  const attacker = getUnitById(attackerId);
  const defender = getUnitById(targetId);
  if (
    !attacker ||
    !defender ||
    attackerId === targetId ||
    attacker.ownerCode === defender.ownerCode ||
    attacker.status === "pending"
  ) return { resolved: false };

  // Out-of-range attacks don't resolve instantly (no striking across the
  // planet): they become an approach order the AI plays out over turns,
  // judged against the era, unit type and logistics.
  const distance = distanceKm(attacker, defender);
  const range = engagementRangeKm(attacker.type, gameDate);
  if (distance > range) {
    const saved = await commit((list) =>
      list.map((u) =>
        u.id === attackerId ? { ...u, status: "moving", updatedAt: new Date().toISOString() } : u,
      ),
    );
    if (!saved) return { resolved: false, distance, range, saveFailed: true };
    await queueOrder(
      `Attack order (approach required): ${attacker.name} (${attacker.type}, id ${attacker.id}, owner ${attacker.ownerCode}) ` +
        `is ordered against ${defender.name} (id ${defender.id}, owner ${defender.ownerCode}) about ${Math.round(distance)} km away — ` +
        `beyond its ~${range} km engagement reach for this era. March/sail/fly it toward the target realistically across turns ` +
        `and resolve the clash when contact is actually possible, or reject the order with an event explaining why it is infeasible.` +
        `${targetRegion?.id ? ` Target region: ${targetRegion.name || targetRegion.id} (exact id ${targetRegion.id}); no local capture has occurred.` : ""}`,
    );
    return { resolved: false, distance, range };
  }

  const result = resolveClash(attacker, defender, round);
  const destinationRegion = targetRegion?.id
    ? targetRegion
    : defender.regionId
      ? { id: defender.regionId, name: defender.regionId, ownerCode: defender.ownerCode }
      : null;
  let capture = null;
  const saved = await commitWorld((world) => {
    const timestamp = new Date().toISOString();
    const nextUnits = (world.units ?? [])
      .map((u) => {
        if (u.id === attackerId) {
          const survives = result.attackerStrength > 0;
          return {
            ...u,
            strength: result.attackerStrength,
            status: survives ? "engaged" : "defeated",
            lng: survives && result.captured ? defender.lng : u.lng,
            lat: survives && result.captured ? defender.lat : u.lat,
            regionId: survives && result.captured && destinationRegion?.id
              ? destinationRegion.id
              : u.regionId,
            updatedAt: timestamp,
          };
        }
        if (u.id === targetId) {
          return {
            ...u,
            strength: result.defenderStrength,
            status: result.defenderStrength > 0 ? "engaged" : "defeated",
            updatedAt: timestamp,
          };
        }
        return u;
      })
      .filter((u) => u.strength > 0);
    if (!result.captured) return { ...world, units: nextUnits };

    const applied = applyRegionCaptureToWorld({
      world,
      units: nextUnits,
      unitId: attackerId,
      region: destinationRegion,
    });
    capture = applied.capture;
    return applied.world;
  });
  if (!saved) {
    capture = null;
    return { resolved: false, distance, range, saveFailed: true };
  }

  await queueOrder(
    `Attack: ${attacker.name} (id ${attacker.id}, owner ${attacker.ownerCode}) assaults ` +
      `${defender.name} (id ${defender.id}, owner ${defender.ownerCode}). Local resolution -> ` +
      `attacker strength ${result.attackerStrength}, defender strength ${result.defenderStrength}` +
      `${capture
        ? `; attacker holds ${capture.regionName} (exact id ${capture.regionId}) and local ownership already changed from ${capture.fromCode || "unclaimed"} to ${capture.toCode}`
        : result.captured
          ? `; attacker holds the field${destinationRegion?.id ? ` in exact region ${destinationRegion.id}` : ""}, but local ownership did not change`
          : ""}. ` +
      `Escalate, reinforce or counterattack as the wider front warrants.`,
  );
  return { resolved: true, distance, range, captured: Boolean(capture), capture };
};

export const removeUnit = async (unitId) =>
  commit((list) => list.filter((u) => u.id !== unitId));
