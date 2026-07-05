/*! Open Historia — custom map background renderer © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import { useEffect, useState } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { JSON_URLS, readJson } from "../../runtime/assets.js";

// Renders a custom map background uploaded in the editor: an image placed by its
// geographic extent, or a vector (GeoJSON) overlay. The light descriptor
// (world.background = { kind, coordinates }) rides on the 5s world poll; the heavy
// payload (image data URL / vector GeoJSON) lives in the backgroundData asset and
// is fetched once when a background appears. This must render BEFORE <Nations> in
// <World> so its layers sit above the ESRI basemap but beneath the region fills.
export default function CustomMapBackground() {
  // The descriptor from world.json (polled — matches how Nations reads worldState).
  const [descriptor, setDescriptor] = useState(null);
  // The heavy payload from the backgroundData asset (loaded once per background).
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      readJson(JSON_URLS.world, { defaultValue: {}, force: true })
        .then((world) => {
          if (cancelled) return;
          const bg = world?.background;
          setDescriptor(bg && typeof bg === "object" && bg.kind ? bg : null);
        })
        .catch(() => {});
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // A stable identity for the current background so we only refetch the (large)
  // payload when it actually changes, not on every 5s poll returning the same one.
  const bgKey = descriptor ? `${descriptor.kind}:${JSON.stringify(descriptor.coordinates ?? null)}` : "";

  useEffect(() => {
    if (!descriptor) {
      setPayload(null);
      return undefined;
    }
    let cancelled = false;
    readJson(JSON_URLS.backgroundData, { defaultValue: null, force: true })
      .then((data) => {
        if (!cancelled) setPayload(data && typeof data === "object" ? data : null);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgKey]);

  if (!descriptor || !payload) return null;

  if (descriptor.kind === "image" && payload.dataUrl && Array.isArray(descriptor.coordinates)) {
    return (
      // key on the placement so MapLibre rebuilds the image source when the extent
      // changes (its coordinates are otherwise fixed at creation).
      <Source
        key={bgKey}
        id="custom-map-bg"
        type="image"
        url={payload.dataUrl}
        coordinates={descriptor.coordinates}
      >
        <Layer id="custom-map-bg-layer" type="raster" paint={{ "raster-opacity": 1, "raster-fade-duration": 0 }} />
      </Source>
    );
  }

  if (descriptor.kind === "vector" && payload.geojson && Array.isArray(payload.geojson.features)) {
    return (
      <Source id="custom-map-bg-vec" type="geojson" data={payload.geojson}>
        <Layer
          id="custom-map-bg-vec-fill"
          type="fill"
          filter={["==", ["geometry-type"], "Polygon"]}
          paint={{ "fill-color": "#6b7c99", "fill-opacity": 0.35 }}
        />
        <Layer
          id="custom-map-bg-vec-line"
          type="line"
          paint={{ "line-color": "rgba(255,255,255,0.65)", "line-width": 1 }}
        />
      </Source>
    );
  }

  return null;
}
