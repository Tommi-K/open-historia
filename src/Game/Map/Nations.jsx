import { useEffect, useState, useMemo } from "react";
import { Protocol } from "pmtiles";
import * as maplibregl from "maplibre-gl";
import { Source, Layer } from "react-map-gl/maplibre";

const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const WorldMap = () => {
  const [colorMap, setColorMap] = useState({});

  useEffect(() => {
    fetch("/assets/colors.json")
      .then((res) => res.json())
      .then((colors) => {
        setColorMap(colors);
      })
      .catch((err) => console.error("Napaka pri nalaganju barv:", err));
  }, []);

  // Country fill
  const fillStyle = useMemo(() => {
    const stops = Object.entries(colorMap).map(([iso, rgb]) => [
      iso,
      `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    ]);

    const fallbackColor = [
      "rgb",
      ["+", 64, ["*", ["index-of", ["slice", ["get", "GID_0"], 0, 1], "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], 5]],
      ["+", 64, ["*", ["index-of", ["slice", ["get", "GID_0"], 2, 3], "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], 5]],
      ["+", 64, ["*", ["index-of", ["slice", ["get", "GID_0"], 1, 2], "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], 5]]
    ];

    return {
      "fill-color":
      stops.length > 0
      ? [
        "match",
        ["get", "GID_0"],
        ...stops.flat(),
        fallbackColor,
      ]
      : 'white',
      "fill-opacity": 0.5,
    };
  }, [colorMap]);

  return (
    <>
      {/* Regions */}
      <Source type="vector" url="pmtiles:///assets/regions.pmtiles">
        <Layer type="fill" source-layer="regions" paint={fillStyle} />

        <Layer
          type="line"
          source-layer="regions"
          paint={{
            "line-color": "#0F0F0F",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3.25,
              0,
              10,
              1.5,
            ],
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3.25,
              0.25,
              10,
              1,
            ],
          }}
        />
      </Source>

      {/* Nations */}
      <Source
        id="countries-source"
        type="vector"
        url="pmtiles:///assets/countries.pmtiles"
      >
        <Layer
          id="countries-outline"
          type="line"
          source-layer="countries"
          paint={{
            "line-color": "#000",
            "line-width": 1.5,
            "line-opacity": 1,
          }}
        />
      </Source>
    </>
  );
};

export default WorldMap;
