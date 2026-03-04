import React, { useState, useEffect } from 'react';

const baseStyle: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontFamily: 'sans-serif',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
};

const Toggle = ({ label, enabled, onToggle }: { label: string, enabled: boolean, onToggle: () => void }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
    }}>
    <span style={{ fontSize: '0.9rem' }}>{label}</span>
    <button
    onClick={onToggle}
    style={{
        width: '3.5rem',
        height: '1.75rem',
        borderRadius: '1rem',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: '0.3s',
        backgroundColor: enabled ? '#3b82f6' : '#4b5563',
    }}
    >
    <div style={{
        position: 'absolute',
        top: '2px',
        left: enabled ? '1.8rem' : '2px',
        width: '1.5rem',
        height: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '50%',
        transition: '0.3s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }} />
    </button>
    </div>
);


const main: React.FC = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGlobeEnabled, setIsGlobeEnabled] = useState(false);
    const [isTerrainEnabled, setIsTerrainEnabled] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <>
        {/* Date */}
        <div style={{
            ...baseStyle,
            top: '0.5rem',
            right: '0.5rem',

            height: '3.75rem',
            width: '18rem',
        }}>
        March 1st, 2026
        </div>

        {/* Other */}
        <div style={{
            ...baseStyle,
            bottom: '0.5rem',
            left: '0.5rem',

            height: '4rem',
            width: '8.75rem',
        }}/>

        {/* Advisor */}
        <button style={{
            ...baseStyle,
            bottom: '0.5rem',
            right: '0.5rem',

            height: '4rem',
            width: '4rem',

            cursor: 'pointer',
        }}/>

        {/* Settings */}
        <button
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        style={{
            ...baseStyle,
            top: '0.5rem',
            left: '0.5rem',
            height: '4rem',
            width: '4rem',
            cursor: 'pointer',
            fontSize: '1.5rem'
        }}>
        ⚙️
        </button>

        {/* Settings Menu */}
        {isSettingsOpen && (
            <div style={{
                ...baseStyle,
                top: '5rem',
                left: '0.5rem',
                width: '16rem',
                padding: '1.25rem',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                height: 'auto'
            }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', textAlign: 'left' }}>Map Settings</h3>

            <Toggle label="Fullscreen"
            enabled={isFullscreen}
            onToggle={toggleFullscreen}
            />

            <Toggle label="3D Globe"
            enabled={isGlobeEnabled}
            onToggle={() => setIsGlobeEnabled(!isGlobeEnabled)}
            />

            <Toggle label="3D Terrain"
            enabled={isTerrainEnabled}
            onToggle={() => setIsTerrainEnabled(!isTerrainEnabled)}
            />

            </div>
        )}
        </>
    );
};

export default main;
