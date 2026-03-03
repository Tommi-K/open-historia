import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import WorldMap from './Nations';

function App() {
    return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000' }}>
        <Map
            initialViewState={{
                longitude: 0,
                latitude: 0,
                zoom: 3.5
            }}
            minZoom={2.25}
            maxZoom={16}
            doubleClickZoom={false}

            maxBounds={[
                [-Infinity, -80],
                [Infinity, 85]
            ]}

            cursor="default"
            attributionControl={false}

            dragRotate={false}
            touchPitch={false}
            pitchWithRotate={false}

            mapStyle={{
                version: 8,
                sources: {
                    'satellite': {
                        type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256
                    }
                },
                layers: [{
                    id: 'satellite-layer',
                type: 'raster',
                source: 'satellite'
                }]
            }}
            >

            <WorldMap />
        </Map>
        </div>
    );
}

export default App;
