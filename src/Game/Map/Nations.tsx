import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

const WorldMap = () => {
    const map = useMap();
    const [countriesData, setCountriesData] = useState(null);
    const [subdivisionsData, setSubdivisionsData] = useState(null);
    const [colorMap, setColorMap] = useState({});

    const countryStyle = (properties) => {
        const isoCode = properties["SOV_A3"];
        const rgb = colorMap[isoCode];

        const fillColor = rgb
        ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
        : 'white';

        return {
            color: 'black',
            weight: 1,
            fill: true,
            fillColor: fillColor,
            fillOpacity: 0.4
        };
    };

    useEffect(() => {
        fetch('/assets/colors.json')
        .then(res => res.json())
        .then(data => setColorMap(data));

        fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(data => setCountriesData(data));

        fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson')
        .then(res => res.json())
        .then(data => setSubdivisionsData(data));
    }, []);

    useEffect(() => {
        if (!map || !countriesData || !subdivisionsData) return;

        let layers = [];

        const countryGrid = L.vectorGrid.slicer(countriesData, {
            rendererFactory: L.canvas.tile,
            vectorTileLayerStyles: {
                sliced: (properties) => countryStyle(properties)
            },
        }).addTo(map);

        layers.push(countryGrid);



        const subGrid = L.vectorGrid.slicer(subdivisionsData, {
            rendererFactory: L.canvas.tile,
            vectorTileLayerStyles: {
                sliced: {
                    color: 'black',
                    weight: 0.2,
                    fill: false
                }
            },
        }).addTo(map);
        layers.push(subGrid);


        return () => {
            layers.forEach(l => map.removeLayer(l));
        };
    }, [countriesData, subdivisionsData, colorMap, map]);

    return null;
};

export default WorldMap;
