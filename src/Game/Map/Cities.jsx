import React, { useEffect } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import * as pmtiles from 'pmtiles';

const Cities = () => {
    const { current: map } = useMap();

    useEffect(() => {
        if (!map) return;
        const protocol = new pmtiles.Protocol();
        try {
            const maplibregl = map.getMap()._lib;
            if (maplibregl && !maplibregl.getProtocol('pmtiles')) {
                maplibregl.addProtocol('pmtiles', protocol.tile);
            }
        } catch (e) {
            console.error("PMTiles protocol error:", e);
        }
    }, [map]);

    const PMTILES_URL = "pmtiles:///assets/cities.pmtiles";

    const populationFilter = [
        "all",
        // Show 0 cities if zoom is more than 3
        [">", ["zoom"], 3],

        // Show capitals then relative of population
        [
            "any",
            ["==", ["get", "capital"], "primary"],
            [
                ">",
                ["get", "population"],
                [
                    "step", ["zoom"],
                    2500000,
                    5, 1000000,
                    6, 500000,
                    7, 250000,
                    8, 100000,
                ]
            ]
        ]
    ];

    return (
        <Source id="cities-source" type="vector" url={PMTILES_URL}>
        {/* City marker */}
        <Layer
        id="cities-shapes"
        type="symbol"
        source-layer="cities"
        filter={populationFilter}
        layout={{
            'text-field': [
                'case',
                // Capitals
                ['==', ['get', 'capital'], 'primary'], '★',

                // Big cities
                ['>=', ['get', 'population'], 2500000], '◆',

                // All other cities
                '■'
            ],
            'text-size': [
                'interpolate', ['linear'], ['zoom'],
                3, [
                    'interpolate', ['linear'], ['get', 'population'],
                    100000, 6,
                    1000000, 10
                ],
                10, 22
            ],
            'symbol-sort-key': ['-', ['get', 'population']],
            'text-allow-overlap': true,
            'text-padding': 0
        }}
        paint={{
            'text-color': 'rgba(0,0,0,0)',

            'text-halo-color': '#ffffff',
            'text-halo-width': 0.5
        }}
        />

        {/* City label */}
        <Layer
        id="cities-labels"
        type="symbol"
        source-layer="cities"
        filter={populationFilter}
        layout={{
            'text-field': ['get', 'city'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': [
                'interpolate', ['linear'], ['zoom'],
                3, 8,
                10, 10
            ],
            'symbol-sort-key': ['-', ['get', 'population']],
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            'text-radial-offset': 0.7,
            'text-padding': 5
        }}
        paint={{
            'text-color': '#ffffff',
            'text-halo-color': '#333333',
            'text-halo-width': 2
        }}
        />
        </Source>
    );
};

export default Cities;
