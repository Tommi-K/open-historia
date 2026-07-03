/*! Open Historia — globe sun, day/night terminator + rotation © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";

// One full rotation of the earth every 10 minutes.
const ROTATION_DEG_PER_MS = 360 / (10 * 60 * 1000);
// The sun sits this many degrees east of the camera center — matching the
// glow drawn at the upper right of the screen (see SunGlow in World.jsx).
// The lit hemisphere is centered on it; as the auto-rotation carries the
// earth beneath the camera, countries sweep from day into night.
const SUN_OFFSET_DEG = 55;
// Soft terminator: a twilight band this wide on each side of the hard edge.
const TWILIGHT_DEG = 16;
// Resume the rotation this long after the player stops touching the map.
const INTERACTION_GRACE_MS = 3000;

const NIGHT_CORE_ID = "globe-night-core";
const NIGHT_DUSK_ID = "globe-night-dusk";
const NIGHT_DAWN_ID = "globe-night-dawn";

// A lat/lng band polygon densified so globe projection curves it correctly.
// Longitudes may exceed ±180 — angles are periodic on the sphere.
const bandFeature = (west, east) => {
  const top = 89.9;
  const bottom = -89.9;
  const ring = [];
  for (let lng = west; lng < east; lng += 5) ring.push([lng, top]);
  ring.push([east, top]);
  for (let lat = top; lat > bottom; lat -= 5) ring.push([east, lat]);
  ring.push([east, bottom]);
  for (let lng = east; lng > west; lng -= 5) ring.push([lng, bottom]);
  ring.push([west, bottom]);
  for (let lat = bottom; lat < top; lat += 5) ring.push([west, lat]);
  ring.push([west, top]);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
};

const collection = (...features) => ({ type: "FeatureCollection", features });

const GlobeEffects = ({ active }) => {
  const { current: map } = useMap();
  const [sunLng, setSunLng] = useState(SUN_OFFSET_DEG);

  // --- Auto-rotation, paused while (and shortly after) the player interacts.
  useEffect(() => {
    if (!active || !map) return undefined;
    const mapInstance = map.getMap?.() ?? map;
    let frameId = 0;
    let lastTick = performance.now();
    let lastInteraction = 0;

    const markInteraction = () => {
      lastInteraction = performance.now();
    };
    const interactionEvents = ["dragstart", "zoomstart", "rotatestart", "pitchstart", "wheel"];
    for (const event of interactionEvents) mapInstance.on(event, markInteraction);

    const tick = (now) => {
      const dt = now - lastTick;
      lastTick = now;
      const idle = now - lastInteraction > INTERACTION_GRACE_MS;
      if (idle && !mapInstance.isMoving()) {
        const center = mapInstance.getCenter();
        // West-to-east spin: the world slides eastward beneath a camera that
        // is fixed (with the sun) in space.
        mapInstance.jumpTo({ center: [center.lng - ROTATION_DEG_PER_MS * dt, center.lat] });
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      for (const event of interactionEvents) mapInstance.off(event, markInteraction);
    };
  }, [active, map]);

  // --- Keep the lit hemisphere pointed at the on-screen sun, and the night
  // layers above everything else (fills, borders, labels, units — the sun's
  // light governs all of it). Half-second cadence: the terminator only moves
  // 0.3° per step, far below what the eye can pick out.
  useEffect(() => {
    if (!active || !map) return undefined;
    const mapInstance = map.getMap?.() ?? map;
    const sync = () => {
      const center = mapInstance.getCenter();
      setSunLng(((center.lng + SUN_OFFSET_DEG + 180) % 360 + 360) % 360 - 180);
      for (const id of [NIGHT_DAWN_ID, NIGHT_DUSK_ID, NIGHT_CORE_ID]) {
        if (mapInstance.getLayer(id)) {
          try {
            mapInstance.moveLayer(id);
          } catch {
            /* layer mid-update — next tick reorders it */
          }
        }
      }
    };
    sync();
    const intervalId = setInterval(sync, 500);
    return () => clearInterval(intervalId);
  }, [active, map]);

  const nightCore = useMemo(
    () => collection(bandFeature(sunLng + 90 + TWILIGHT_DEG, sunLng + 270 - TWILIGHT_DEG)),
    [sunLng],
  );
  const duskBand = useMemo(
    () => collection(bandFeature(sunLng + 90 - TWILIGHT_DEG, sunLng + 90 + TWILIGHT_DEG)),
    [sunLng],
  );
  const dawnBand = useMemo(
    () => collection(bandFeature(sunLng + 270 - TWILIGHT_DEG, sunLng + 270 + TWILIGHT_DEG)),
    [sunLng],
  );

  if (!active) return null;

  return (
    <>
      <Source id="globe-night-core-source" type="geojson" data={nightCore}>
        <Layer
          id={NIGHT_CORE_ID}
          type="fill"
          paint={{ "fill-color": "#020617", "fill-opacity": 0.52, "fill-antialias": false }}
        />
      </Source>
      <Source id="globe-night-dusk-source" type="geojson" data={duskBand}>
        <Layer
          id={NIGHT_DUSK_ID}
          type="fill"
          paint={{ "fill-color": "#0b1020", "fill-opacity": 0.24, "fill-antialias": false }}
        />
      </Source>
      <Source id="globe-night-dawn-source" type="geojson" data={dawnBand}>
        <Layer
          id={NIGHT_DAWN_ID}
          type="fill"
          paint={{ "fill-color": "#0b1020", "fill-opacity": 0.24, "fill-antialias": false }}
        />
      </Source>
    </>
  );
};

export default GlobeEffects;
