import { MapContainer, TileLayer} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import Nations from './Nations'

function App() {

    return (
        <div style={{
            height: '100vh',
            width: '100vw'
        }}>

        <MapContainer
            maxBounds={[
                [-80, -Infinity],
                [90, Infinity]
            ]}

            maxBoundsViscosity={1}
            minZoom={3.3}
            zoom={3.5}


            center={[0,0]}

            zoomControl={false}
            attributionControl={false}

            style={{
                height: '100%',
                width: '100%',
                backgroundColor: '#000000',
                cursor: 'default'
        }}

        preferCanvas={true}
        >

        <TileLayer // Satelite
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <Nations />

        </MapContainer>
    </div>
    )
}

export default App
