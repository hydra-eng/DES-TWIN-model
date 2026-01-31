import { useMemo, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
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

export default function MapViz() {
    const { result, stations } = useSimulationStore();
    const mapRef = useRef<MapRef>(null);
    const prevStationsLength = useRef(stations.length);

    // Effect: Fly to new station when added
    useEffect(() => {
        if (stations.length > prevStationsLength.current) {
            const newStation = stations[stations.length - 1];
            if (newStation && mapRef.current) {
                mapRef.current.flyTo({
                    center: [newStation.location.lon, newStation.location.lat],
                    zoom: 13,
                    duration: 2000,
                    essential: true
                });
            }
        }
        prevStationsLength.current = stations.length;
    }, [stations]);

    const layers = useMemo(() => {
        let stationData = stations.map(s => ({
            ...s,
            position: [s.location.lon, s.location.lat],
            color: [69, 162, 158], // Default Teal
            radius: 200
        }));

        // If we have simulation results, override with KPI data
        if (result?.station_kpis) {
            stationData = stations.map(s => {
                const kpi = result.station_kpis.find((k: any) => k.station_id === s.id);

                let color: [number, number, number] = [69, 162, 158]; // Default
                let radius = 200;

                if (kpi) {
                    if (kpi.lost_swaps > 0 || kpi.avg_wait_time_seconds > 600) {
                        color = [255, 0, 60]; // Critical Red
                    } else if (kpi.avg_wait_time_seconds < 300 && kpi.charger_utilization > 0.5) {
                        color = [102, 252, 241]; // Good Cyan
                    } else if (kpi.avg_wait_time_seconds < 600) {
                        color = [255, 165, 0]; // Warning Orange
                    }

                    radius = 150 + (kpi.total_swaps * 3);
                }

                return {
                    ...s,
                    position: [s.location.lon, s.location.lat],
                    color,
                    radius,
                    kpi
                };
            });
        }

        return [
            new ScatterplotLayer({
                id: 'stations',
                data: stationData,
                pickable: true,
                opacity: 0.8,
                stroked: true,
                filled: true,
                radiusScale: 1,
                radiusMinPixels: 8,
                radiusMaxPixels: 60,
                lineWidthMinPixels: 2,
                getPosition: (d: any) => d.position,
                getRadius: (d: any) => d.radius,
                getFillColor: (d: any) => d.color,
                getLineColor: [255, 255, 255],
                updateTriggers: {
                    getFillColor: [result, stations.length],
                    getRadius: [result, stations.length],
                    getPosition: [stations.length]
                }
            })
        ];
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
              ${object.kpi ? `
                <div style="font-size: 11px; line-height: 1.6;">
                  <div>Swaps: <span style="color: white;">${object.kpi.total_swaps}</span></div>
                  <div>Lost: <span style="color: ${object.kpi.lost_swaps > 0 ? '#ff003c' : 'white'};">${object.kpi.lost_swaps}</span></div>
                  <div>Wait: <span style="color: white;">${object.kpi.avg_wait_time_seconds.toFixed(0)}s</span></div>
                  <div>Utilization: <span style="color: white;">${(object.kpi.charger_utilization * 100).toFixed(0)}%</span></div>
                </div>
              ` : `
                <div style="font-size: 11px; color: #999;">
                    <div>Chargers: ${object.charger_count}</div>
                    <div>Batteries: ${object.total_batteries}</div>
                    <div style="margin-top:4px; font-style:italic">Ready to simulate</div>
                </div>
              `}
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
                <div className="font-bold mb-3 text-neon-blue uppercase tracking-wider">Station Status</div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#66fcf1]"></div>
                        <span className="text-gray-300">Healthy (&lt;5min wait)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ffa500]"></div>
                        <span className="text-gray-300">Warning (5-10min)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ff003c]"></div>
                        <span className="text-gray-300">Critical (&gt;10min)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#45a29e]"></div>
                        <span className="text-gray-300">Configured (No Sim)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
