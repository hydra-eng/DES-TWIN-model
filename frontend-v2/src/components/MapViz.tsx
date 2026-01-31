import { useMemo, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { Map, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSimulationStore } from '../store/simulationStore';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL_VIEW_STATE = {
    longitude: 77.2090,
    latitude: 28.6139,
    zoom: 11,
    pitch: 30,
    bearing: 0
};

// Define status colors for Scenario Stations
const STATUS_COLORS = {
    ACTIVE: [0, 255, 128], // Green
    INACTIVE: [255, 0, 60], // Red
    MAINTENANCE: [255, 200, 0] // Yellow
};

export default function MapViz() {
    const { result, stations } = useSimulationStore();
    const mapRef = useRef<MapRef>(null);

    // Effect: Auto-center map on stations when loaded
    useEffect(() => {
        if (stations.length > 0 && mapRef.current) {
            // Calculate centroid
            const latSum = stations.reduce((sum, s) => sum + s.location.lat, 0);
            const lonSum = stations.reduce((sum, s) => sum + s.location.lon, 0);
            const centerLat = latSum / stations.length;
            const centerLon = lonSum / stations.length;

            mapRef.current.flyTo({
                center: [centerLon, centerLat],
                zoom: 12, // Review: maybe dynamic zoom based on spread? 12 is safe.
                duration: 2000,
                essential: true
            });
            console.log("Map centering on:", centerLat, centerLon);
        }
    }, [stations]);

    const layers = useMemo(() => {
        const coreStations = stations.filter(s => s.type === 'CORE' || !s.type); // Default to core if undefined
        const scenarioStations = stations.filter(s => s.type === 'SCENARIO');

        // --- Layer 1: Core Stations (Icons) ---
        // Icons scale smoothly with map zoom for optimal UX
        // sizeUnits: 'meters' makes icons scale naturally with the map
        const iconLayer = new IconLayer({
            id: 'core-stations',
            data: coreStations,
            pickable: true,
            iconAtlas: '/station_icon.png',
            iconMapping: {
                marker: { x: 0, y: 0, width: 1024, height: 1024, mask: false }
            },
            getIcon: () => 'marker',
            // Size units in meters - icons scale naturally with map zoom
            sizeUnits: 'meters',
            sizeScale: 1,
            sizeMinPixels: 8,   // Min 8px when very zoomed out (overview)
            sizeMaxPixels: 64,  // Max 64px when zoomed in (detail view)
            getPosition: (d: any) => [d.location.lon, d.location.lat],
            getSize: 150, // Size in meters - feels natural at city scale
            // Smooth transitions
            transitions: {
                getPosition: 300,
                getSize: 300
            },
            updateTriggers: {
                getPosition: [stations.length]
            }
        });


        // --- Layer 2: Scenario Stations (Dots) ---
        // Basic Logic: Status Colors
        // Advanced Logic: KPI Overrides if result exists
        const scatterData = scenarioStations.map(s => {
            let color = STATUS_COLORS.ACTIVE; // Default Green

            // Map status string to color
            if (s.status === 'INACTIVE') color = STATUS_COLORS.INACTIVE;
            if (s.status === 'MAINTENANCE') color = STATUS_COLORS.MAINTENANCE;

            // KPI Override (during simulation)
            if (result?.station_kpis) {
                const kpi = result.station_kpis.find((k: any) => k.station_id === s.id);
                if (kpi) {
                    if (kpi.lost_swaps > 0) color = [255, 0, 60]; // Red
                    else if (kpi.charger_utilization > 0.8) color = [255, 165, 0]; // Orange
                }
            }

            return {
                ...s,
                color,
                radius: 100
            };
        });

        const scatterLayer = new ScatterplotLayer({
            id: 'scenario-stations',
            data: scatterData,
            pickable: true,
            opacity: 0.9,
            stroked: true,
            filled: true,
            radiusScale: 1,
            radiusMinPixels: 6,
            radiusMaxPixels: 30,
            lineWidthMinPixels: 2,
            getPosition: (d: any) => [d.location.lon, d.location.lat],
            getRadius: (d: any) => d.radius,
            getFillColor: (d: any) => d.color,
            getLineColor: [255, 255, 255],
            updateTriggers: {
                getFillColor: [result, stations.length],
                getRadius: [result, stations.length],
                getPosition: [stations.length]
            }
        });

        return [iconLayer, scatterLayer];
    }, [result, stations]);

    return (
        <div className="w-full h-full relative">
            <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                getTooltip={({ object }: any) => object && {
                    html: `
            <div style="background: rgba(0,0,0,0.9); padding: 12px; border: 1px solid #45a29e; border-radius: 4px; color: white; font-family: monospace;">
              <div style="font-size: 14px; font-weight: bold; color: #66fcf1; margin-bottom: 8px;">${object.name}</div>
              <div style="font-size: 10px; color: #888; margin-bottom: 4px;">ID: ${object.id}</div> 
              <div style="font-size: 10px; font-weight:bold; color: ${object.type === 'CORE' ? '#45a29e' : '#fff'}; margin-bottom: 8px;">
                ${object.type || 'CORE'} ${object.status ? `(${object.status})` : ''}
              </div>
              
              <div style="font-size: 11px; color: #ccc;">
                  <div>Chargers: ${object.charger_count}</div>
                  <div>Batteries: ${object.total_batteries}</div>
              </div>
            </div>
          `,
                    style: {
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: 0
                    }
                }}
            >
                <Map
                    ref={mapRef}
                    mapLib={maplibregl}
                    mapStyle={MAP_STYLE}
                    attributionControl={false}
                />
            </DeckGL>

            {/* Legend */}
            <div className="absolute bottom-6 right-6 bg-black/80 border border-neutral-700 rounded p-4 text-white text-xs backdrop-blur-sm z-20">
                <div className="font-bold mb-3 text-neon-blue uppercase tracking-wider">Map Legend</div>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <img src="/station_icon.png" className="w-4 h-5 object-contain" alt="Core" />
                        <span className="text-white font-bold">Core Infrastructure</span>
                    </div>
                    <div className="h-px bg-white/10 my-2"></div>
                    <div className="text-[10px] text-gray-400 uppercase mb-1">Added Stations</div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#00ff80] border border-white/50"></div>
                        <span className="text-gray-300">Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ffc800] border border-white/50"></div>
                        <span className="text-gray-300">Maintenance</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ff003c] border border-white/50"></div>
                        <span className="text-gray-300">Inactive</span>
                    </div>
                </div>
            </div>
            {/* Debug Overlay */}
            <div className="absolute top-4 right-4 bg-black/80 text-white p-2 text-xs rounded z-30 font-mono pointer-events-none">
                Stations: {stations.length}<br />
                Core: {stations.filter(s => s.type === 'CORE' || !s.type).length}<br />
                Scenario: {stations.filter(s => s.type === 'SCENARIO').length}<br />
                Center: {mapRef.current?.getCenter().lat.toFixed(4)}, {mapRef.current?.getCenter().lng.toFixed(4)}
            </div>
        </div>
    );
}
