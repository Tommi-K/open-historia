const normalizeString = (value) => String(value ?? "").trim();

const GROUND_UNIT_TYPES = new Set(["infantry", "armor", "artillery", "garrison"]);
const NON_OCCUPYING_STATUSES = new Set(["defeated", "pending"]);

const isActiveGroundUnit = (unit) =>
  Boolean(
    unit &&
    GROUND_UNIT_TYPES.has(normalizeString(unit.type).toLowerCase()) &&
    !NON_OCCUPYING_STATUSES.has(normalizeString(unit.status).toLowerCase()) &&
    Number(unit.strength) > 0 &&
    normalizeString(unit.ownerCode),
  );

const featureRegionId = (feature) => normalizeString(
  feature?.properties?.GID_1 ?? feature?.properties?.id,
);

export const selectRegionFeature = ({
  customStockRegionIds = new Set(),
  features = [],
  hasDrawnGeometry = false,
} = {}) => {
  const allowedStockIds = customStockRegionIds instanceof Set
    ? customStockRegionIds
    : new Set(Array.isArray(customStockRegionIds) ? customStockRegionIds : []);
  return (Array.isArray(features) ? features : []).find((feature) => {
    if (feature?.layer?.id !== "regions-fill" || !hasDrawnGeometry) return true;
    return allowedStockIds.has(featureRegionId(feature));
  }) ?? null;
};

export const resolveRegionTarget = ({
  ownerLookup = null,
  ownershipOverrides = {},
  properties = {},
} = {}) => {
  const id = normalizeString(properties.GID_1 ?? properties.id);
  if (!id) return null;

  const hasOverride = Object.prototype.hasOwnProperty.call(ownershipOverrides ?? {}, id);
  const lookupOwner = ownerLookup instanceof Map
    ? ownerLookup.get(id)
    : ownerLookup?.[id];
  const featureOwner = properties.owner;
  const ownerCode = hasOverride
    ? ownershipOverrides[id]
    : featureOwner != null
      ? featureOwner
      : lookupOwner != null
        ? lookupOwner
        : properties.GID_0 ?? properties.gid0;

  return {
    id,
    name: normalizeString(properties.NAME_1 ?? properties.name) || id,
    ownerCode: normalizeString(ownerCode),
  };
};

export const resolveRegionCapture = ({ region, unit, units = [] } = {}) => {
  const regionId = normalizeString(region?.id);
  const toCode = normalizeString(unit?.ownerCode);
  const fromCode = normalizeString(region?.ownerCode);
  if (!regionId || !toCode || fromCode === toCode || !isActiveGroundUnit(unit)) return null;

  const directlyDefendingIds = new Set(
    Array.isArray(region?.defendingUnitIds)
      ? region.defendingUnitIds.map(normalizeString).filter(Boolean)
      : [],
  );
  const hasHostileGroundDefender = (Array.isArray(units) ? units : []).some((candidate) => {
    if (!isActiveGroundUnit(candidate)) return false;
    if (normalizeString(candidate.id) === normalizeString(unit.id)) return false;
    if (normalizeString(candidate.ownerCode) === toCode) return false;
    return normalizeString(candidate.regionId) === regionId || directlyDefendingIds.has(normalizeString(candidate.id));
  });
  if (hasHostileGroundDefender) return null;

  return {
    fromCode,
    regionId,
    regionName: normalizeString(region?.name) || regionId,
    toCode,
  };
};

export const applyRegionCaptureToWorld = ({ world = {}, units = [], unitId, region }) => {
  if (!region?.id) return { capture: null, world: { ...world, units } };

  const overrides = world.regionOwnershipOverrides ?? {};
  const hasCurrentOverride = Object.prototype.hasOwnProperty.call(overrides, region.id);
  const currentRegion = {
    ...region,
    ownerCode: hasCurrentOverride ? overrides[region.id] : region.ownerCode,
  };
  const occupyingUnit = units.find((unit) => normalizeString(unit?.id) === normalizeString(unitId));
  const capture = resolveRegionCapture({ region: currentRegion, unit: occupyingUnit, units });

  return {
    capture,
    world: {
      ...world,
      units,
      ...(capture
        ? {
            regionOwnershipOverrides: {
              ...overrides,
              [capture.regionId]: capture.toCode,
            },
          }
        : {}),
    },
  };
};
