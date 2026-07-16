import { applyRegionCaptureToWorld } from "./regionCapture.js";

export const buildPlayerDeploymentInput = ({
  type,
  strength,
  name,
  lng,
  lat,
  region = null,
  ownerCode,
} = {}) => ({
  type,
  strength,
  name,
  lng,
  lat,
  regionId: region?.id,
  ownerCode: ownerCode || "PLAYER",
  source: "player",
  status: "idle",
});

export const applyUnitMovementToWorld = ({
  world = {},
  unitId,
  lng,
  lat,
  targetRegion = null,
  timestamp = new Date().toISOString(),
} = {}) => {
  const movingUnit = (world.units ?? []).find((unit) => unit.id === unitId);
  if (!movingUnit || movingUnit.status === "pending") {
    return { capture: null, world };
  }

  const nextUnits = (world.units ?? []).map((unit) =>
    unit.id === unitId
      ? {
          ...unit,
          lng,
          lat,
          regionId: targetRegion?.id || unit.regionId,
          status: unit.status === "pending" ? "pending" : "moving",
          updatedAt: timestamp,
        }
      : unit,
  );

  return applyRegionCaptureToWorld({
    world,
    units: nextUnits,
    unitId,
    region: targetRegion,
  });
};

export const applyCombatResultToWorld = ({
  world = {},
  attackerId,
  defenderId,
  destinationRegion = null,
  result = {},
  timestamp = new Date().toISOString(),
} = {}) => {
  const attackerAdvances = Boolean(
    result.attackerAdvances ?? (result.attackerWins && Number(result.attackerStrength) > 0),
  );
  const sourceUnits = Array.isArray(world.units) ? world.units : [];
  const defender = sourceUnits.find((unit) => unit.id === defenderId);
  const nextUnits = sourceUnits
    .flatMap((unit) => {
      if (unit.id === attackerId) {
        const survives = Number(result.attackerStrength) > 0;
        return [{
          ...unit,
          strength: result.attackerStrength,
          status: survives ? "engaged" : "defeated",
          lng: attackerAdvances && destinationRegion?.id ? defender?.lng ?? unit.lng : unit.lng,
          lat: attackerAdvances && destinationRegion?.id ? defender?.lat ?? unit.lat : unit.lat,
          regionId: attackerAdvances && destinationRegion?.id
            ? destinationRegion.id
            : unit.regionId,
          updatedAt: timestamp,
        }];
      }

      if (unit.id === defenderId) {
        // A surviving winner occupies the field. The loser's remaining combat
        // strength is routed out of this local engagement; there is no retreat
        // destination model yet, so it leaves the active order of battle.
        if (attackerAdvances) return [];
        return [{
          ...unit,
          strength: result.defenderStrength,
          status: Number(result.defenderStrength) > 0 ? "engaged" : "defeated",
          updatedAt: timestamp,
        }];
      }

      return [unit];
    })
    .filter((unit) => Number(unit.strength) > 0 && unit.status !== "defeated");

  if (!attackerAdvances || !destinationRegion?.id) {
    return { capture: null, world: { ...world, units: nextUnits } };
  }

  return applyRegionCaptureToWorld({
    world,
    units: nextUnits,
    unitId: attackerId,
    region: destinationRegion,
  });
};
