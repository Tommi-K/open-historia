import { useEffect, useState, useMemo } from 'react';
import { Protocol } from 'pmtiles';
import * as maplibregl from 'maplibre-gl';
import { Source, Layer } from 'react-map-gl/maplibre';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const WorldMap = () => {
    const [colorMap, setColorMap] = useState({});

    useEffect(() => {
        fetch('/assets/colors.json')
        .then(res => res.json())
        .then(colors => {
            setColorMap(colors);
        })
    }, []);


    const fillStyle = useMemo(() => {
        const stops = Object.entries(colorMap).map(([iso, rgb]) => [
            iso,
            `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
        ]);

        return {
            'fill-color': stops.length > 0
            ? ['match', ['get', 'GID_0'], ...stops.flat(), 'rgba(200, 200, 200, 1)']
            : 'white',
            'fill-opacity': 0.5,
        };
    }, [colorMap]);

    return (
        <Source
        type="vector"
        url="pmtiles:///assets/world.pmtiles"
        >

        <Layer
        type="fill"
        source-layer="world"
        paint={fillStyle}
        />

        <Layer
        type="line"
        source-layer="world"
        paint={{
            'line-color': 'black',
            'line-width': [
                'interpolate', ['linear'], ['zoom'],
                3.25, 0,
                10, 3
            ],
            'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                3.25, 0.25,
                10, 0.5
            ],
        }}
        />
        </Source>
    );
};

export default WorldMap;
