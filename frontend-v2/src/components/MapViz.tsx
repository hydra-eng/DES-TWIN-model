import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
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

// Default stations (when no simulation has run)
const DEFAULT_STATIONS = [
    { id: 'downtown', name: 'Downtown Hub', position: [77.2090, 28.6139], color: [69, 162, 158], radius: 200 },
    { id: 'sector5', name: 'Sector 5 Station', position: [77.2100, 28.5900], color: [69, 162, 158], radius: 200 },
];

export default function MapViz() {
    const { result } = useSimulationStore();

    const layers = useMemo(() => {
        let stationData = DEFAULT_STATIONS;

        // If we have simulation results, update station colors and sizes based on KPIs
        if (result?.station_kpis) {
            stationData = result.station_kpis.map((kpi: any) => {
                // Determine color based on performance
                let color: [number, number, number];

                if (kpi.lost_swaps > 0 || kpi.avg_wait_time_seconds > 600) {
                    // Critical: Red
                    color = [255, 0, 60];
                } else if (kpi.avg_wait_time_seconds < 300 && kpi.charger_utilization > 0.5) {
                    // Good: Green
                    color = [102, 252, 241];
                } else if (kpi.avg_wait_time_seconds < 600) {
                    // Warning: Orange
                    color = [255, 165, 0];
                } else {
                    // Default: Blue
                    color = [69, 162, 158];
                }

                // Size based on total swaps (busier = bigger)
                const radius = 150 + (kpi.total_swaps * 3);

                // Find the station position from the default config
                const defaultStation = DEFAULT_STATIONS.find(s => s.id === kpi.station_id);

                return {
                    id: kpi.station_id,
                    position: defaultStation?.position || [77.2090, 28.6139],
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
                radiusMinPixels: 12,
                radiusMaxPixels: 80,
                lineWidthMinPixels: 3,
                getPosition: (d: any) => d.position,
                getRadius: (d: any) => d.radius,
                getFillColor: (d: any) => d.color,
                getLineColor: [255, 255, 255],
                updateTriggers: {
                    getFillColor: [result],
                    getRadius: [result]
                }
            })
        ];
    }, [result]);

    return (
        <div className="w-full h-full relative">
            <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                getTooltip={({ object }: any) => object && {
                    html: `
            <div style="background: rgba(0,0,0,0.9); padding: 12px; border: 1px solid #45a29e; border-radius: 4px; color: white; font-family: monospace;">
              <div style="font-size: 14px; font-weight: bold; color: #66fcf1; margin-bottom: 8px;">${object.id}</div>
              ${object.kpi ? `
                <div style="font-size: 11px; line-height: 1.6;">
                  <div>Swaps: <span style="color: white;">${object.kpi.total_swaps}</span></div>
                  <div>Lost: <span style="color: ${object.kpi.lost_swaps > 0 ? '#ff003c' : 'white'};">${object.kpi.lost_swaps}</span></div>
                  <div>Wait: <span style="color: white;">${object.kpi.avg_wait_time_seconds.toFixed(0)}s</span></div>
                  <div>Utilization: <span style="color: white;">${(object.kpi.charger_utilization * 100).toFixed(0)}%</span></div>
                </div>
              ` : '<div style="font-size: 11px; color: #999;">No simulation data</div>'}
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
                    mapLib={maplibregl}
                    mapStyle={MAP_STYLE}
                    attributionControl={false}
                />
            </DeckGL>

            {/* Legend */}
            <div className="absolute bottom-6 left-6 bg-black/80 border border-neutral-700 rounded p-4 text-white text-xs backdrop-blur-sm">
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
                        <span className="text-gray-300">Critical (&gt;10min/stockout)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#45a29e]"></div>
                        <span className="text-gray-300">No Data</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
