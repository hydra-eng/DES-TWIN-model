import { useState } from 'react';
import { Building2, Plus, Edit3, Trash2, MapPin } from 'lucide-react';

interface Station {
    id: string;
    name: string;
    location: { lat: number; lon: number };
    total_batteries: number;
    charger_count: number;
    charge_power_kw: number;
    swap_time_seconds: number;
}

interface StationManagerProps {
    stations: Station[];
    onChange: (stations: Station[]) => void;
}

export default function StationManager({ stations, onChange }: StationManagerProps) {
    const [editingId, setEditingId] = useState<string | null>(null);

    const addStation = () => {
        const newStation: Station = {
            id: `station_${Date.now()}`,
            name: `Station ${stations.length + 1}`,
            location: { lat: 28.6139 + (Math.random() - 0.5) * 0.1, lon: 77.2090 + (Math.random() - 0.5) * 0.1 },
            total_batteries: 20,
            charger_count: 4,
            charge_power_kw: 60,
            swap_time_seconds: 90
        };
        onChange([...stations, newStation]);
        // Open the new station in edit mode
        setEditingId(newStation.id);
    };

    const deleteStation = (id: string) => {
        onChange(stations.filter(s => s.id !== id));
    };

    const updateStation = (id: string, updates: Partial<Station>) => {
        onChange(stations.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neon-blue">
                    <Building2 size={16} />
                    <h3 className="font-bold text-sm uppercase tracking-wider">Stations ({stations.length})</h3>
                </div>
                <button
                    onClick={addStation}
                    className="flex items-center gap-1 text-xs bg-neon-blue hover:bg-neon-green text-white px-3 py-1.5 rounded transition-colors font-bold"
                >
                    <Plus size={14} />
                    Add Station
                </button>
            </div>

            {/* Station List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {stations.map((station) => (
                    <div key={station.id} className="bg-neutral-800 border border-neutral-700 rounded p-3">
                        {editingId === station.id ? (
                            // Edit Mode
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={station.name}
                                    onChange={(e) => updateStation(station.id, { name: e.target.value })}
                                    className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1.5 rounded text-sm font-bold"
                                    placeholder="Station Name"
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Latitude</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={station.location.lat}
                                            onChange={(e) => updateStation(station.id, {
                                                location: { ...station.location, lat: parseFloat(e.target.value) }
                                            })}
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1 rounded text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Longitude</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={station.location.lon}
                                            onChange={(e) => updateStation(station.id, {
                                                location: { ...station.location, lon: parseFloat(e.target.value) }
                                            })}
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1 rounded text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Batteries</label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="100"
                                            value={station.total_batteries}
                                            onChange={(e) => updateStation(station.id, { total_batteries: parseInt(e.target.value) })}
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1 rounded text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Chargers</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={station.charger_count}
                                            onChange={(e) => updateStation(station.id, { charger_count: parseInt(e.target.value) })}
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1 rounded text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Power (kW)</label>
                                        <input
                                            type="number"
                                            min="30"
                                            max="150"
                                            step="10"
                                            value={station.charge_power_kw}
                                            onChange={(e) => updateStation(station.id, { charge_power_kw: parseFloat(e.target.value) })}
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1 rounded text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Swap Time (s)</label>
                                        <input
                                            type="number"
                                            min="30"
                                            max="300"
                                            step="10"
                                            value={station.swap_time_seconds}
                                            onChange={(e) => updateStation(station.id, { swap_time_seconds: parseInt(e.target.value) })}
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-2 py-1 rounded text-xs"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => setEditingId(null)}
                                    className="w-full bg-neon-green text-black font-bold py-2 rounded text-xs hover:opacity-90 transition-opacity"
                                >
                                    Done Editing
                                </button>
                            </div>
                        ) : (
                            // View Mode
                            <>
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-bold text-white text-sm">{station.name}</div>
                                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                            <MapPin size={12} />
                                            {station.location.lat.toFixed(4)}, {station.location.lon.toFixed(4)}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setEditingId(station.id)}
                                            className="p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
                                            title="Edit station"
                                        >
                                            <Edit3 size={12} className="text-white" />
                                        </button>
                                        <button
                                            onClick={() => deleteStation(station.id)}
                                            className="p-1.5 bg-red-900/30 hover:bg-red-900/50 rounded transition-colors"
                                            title="Delete station"
                                        >
                                            <Trash2 size={12} className="text-red-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="bg-neutral-900 px-2 py-1.5 rounded">
                                        <div className="text-gray-500">Batteries</div>
                                        <div className="text-white font-mono">{station.total_batteries}</div>
                                    </div>
                                    <div className="bg-neutral-900 px-2 py-1.5 rounded">
                                        <div className="text-gray-500">Chargers</div>
                                        <div className="text-white font-mono">{station.charger_count}</div>
                                    </div>
                                    <div className="bg-neutral-900 px-2 py-1.5 rounded">
                                        <div className="text-gray-500">Power</div>
                                        <div className="text-white font-mono">{station.charge_power_kw}kW</div>
                                    </div>
                                </div>

                                {/* Capacity Warning */}
                                {station.total_batteries / station.charger_count < 3 && (
                                    <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">
                                        ⚠️ Low battery-to-charger ratio
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Quick Stats */}
            <div className="bg-neutral-800 border border-neutral-700 rounded p-3">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Network Capacity</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                        <div className="text-gray-500">Total Batteries</div>
                        <div className="text-white font-mono text-lg">{stations.reduce((sum, s) => sum + s.total_batteries, 0)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500">Total Chargers</div>
                        <div className="text-white font-mono text-lg">{stations.reduce((sum, s) => sum + s.charger_count, 0)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500">Grid Power</div>
                        <div className="text-white font-mono text-lg">{stations.reduce((sum, s) => sum + s.charge_power_kw * s.charger_count, 0)}kW</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
