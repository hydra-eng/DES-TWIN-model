import { useState } from 'react';
import { Zap, Plus, Trash2, Building2, Battery, TrendingUp } from 'lucide-react';

interface Intervention {
    id: string;
    type: string;
    description: string;
    parameters: Record<string, any>;
}

interface InterventionBuilderProps {
    interventions: Intervention[];
    onChange: (interventions: Intervention[]) => void;
    stationIds: string[];
}

export default function InterventionBuilder({ interventions, onChange, stationIds }: InterventionBuilderProps) {
    const [showAddMenu, setShowAddMenu] = useState(false);

    const addIntervention = (type: string) => {
        const newIntervention: Intervention = {
            id: `int_${Date.now()}`,
            type,
            description: getDescription(type),
            parameters: getDefaultParameters(type)
        };

        onChange([...interventions, newIntervention]);
        setShowAddMenu(false);
    };

    const removeIntervention = (id: string) => {
        onChange(interventions.filter(i => i.id !== id));
    };

    const updateIntervention = (id: string, updates: Partial<Intervention>) => {
        onChange(interventions.map(i => i.id === id ? { ...i, ...updates } : i));
    };

    const getDescription = (type: string): string => {
        switch (type) {
            case 'DEMAND_MULTIPLIER':
                return 'Scale demand globally (e.g., festival surge)';
            case 'MODIFY_CHARGERS':
                return 'Change charger count at a station';
            case 'MODIFY_INVENTORY':
                return 'Adjust battery inventory at a station';
            default:
                return '';
        }
    };

    const getDefaultParameters = (type: string): Record<string, any> => {
        switch (type) {
            case 'MODIFY_CHARGERS':
                return { target_station_id: stationIds[0] || 'downtown', new_count: 6 };
            case 'MODIFY_INVENTORY':
                return { target_station_id: stationIds[0] || 'downtown', delta: 5 };
            case 'DEMAND_MULTIPLIER':
                return { multiplier: 1.5, scope: 'global' };
            default:
                return {};
        }
    };

    // Only show intervention types that backend supports
    const interventionTypes = [
        {
            type: 'DEMAND_MULTIPLIER',
            label: 'Demand Surge',
            icon: <TrendingUp size={16} />,
            color: 'from-yellow-600 to-yellow-500',
            description: 'Simulate increased demand (festival, event)'
        },
        {
            type: 'MODIFY_CHARGERS',
            label: 'Add Chargers',
            icon: <Battery size={16} />,
            color: 'from-blue-600 to-blue-500',
            description: 'Increase charging capacity'
        },
        {
            type: 'MODIFY_INVENTORY',
            label: 'Add Batteries',
            icon: <Building2 size={16} />,
            color: 'from-purple-600 to-purple-500',
            description: 'Increase battery stock'
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neon-blue">
                    <Zap size={16} />
                    <h3 className="font-bold text-sm uppercase tracking-wider">What-If Interventions</h3>
                </div>
                <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="flex items-center gap-1 text-xs bg-neon-blue hover:bg-neon-green text-white px-3 py-1.5 rounded transition-colors font-bold"
                >
                    <Plus size={14} />
                    Add
                </button>
            </div>

            {/* Help Text */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3 text-xs text-blue-200">
                <div className="font-bold mb-1">💡 What are interventions?</div>
                Test "what-if" scenarios by adding changes to your simulation (e.g., "What if we add 2 more chargers?" or "What if demand increases 50%?")
            </div>

            {/* Add Intervention Menu */}
            {showAddMenu && (
                <div className="bg-neutral-800 border border-neutral-700 rounded p-3 space-y-2">
                    <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Choose Intervention Type:</div>
                    {interventionTypes.map((it) => (
                        <button
                            key={it.type}
                            onClick={() => addIntervention(it.type)}
                            className={`w-full flex items-center gap-3 bg-gradient-to-r ${it.color} hover:opacity-90 text-white px-3 py-3 rounded transition-all text-left`}
                        >
                            <div className="flex-shrink-0">{it.icon}</div>
                            <div className="flex-1">
                                <div className="text-sm font-bold">{it.label}</div>
                                <div className="text-xs opacity-80 mt-0.5">{it.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Active Interventions */}
            {interventions.length === 0 ? (
                <div className="bg-neutral-800 border border-dashed border-neutral-600 rounded p-8 text-center">
                    <Zap className="mx-auto mb-3 text-gray-600" size={32} />
                    <div className="text-sm text-gray-400 font-bold">No Interventions Yet</div>
                    <div className="text-xs text-gray-600 mt-1">Click "Add" above to test a what-if scenario</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {interventions.map((intervention, index) => {
                        const typeInfo = interventionTypes.find(t => t.type === intervention.type);

                        return (
                            <div key={intervention.id} className="bg-neutral-800 border border-neutral-700 rounded p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded bg-gradient-to-r ${typeInfo?.color || 'from-gray-600 to-gray-500'} flex-shrink-0`}>
                                            {typeInfo?.icon}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{typeInfo?.label || intervention.type}</div>
                                            <div className="text-xs text-gray-500">{intervention.description}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeIntervention(intervention.id)}
                                        className="p-1.5 bg-red-900/30 hover:bg-red-900/50 rounded transition-colors flex-shrink-0"
                                        title="Remove"
                                    >
                                        <Trash2 size={14} className="text-red-400" />
                                    </button>
                                </div>

                                {/* Parameters based on type */}
                                <div className="space-y-3 bg-neutral-900/50 p-3 rounded">
                                    {intervention.type === 'MODIFY_CHARGERS' && (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1.5 font-bold">Station</label>
                                                <select
                                                    value={intervention.parameters.target_station_id}
                                                    onChange={(e) => updateIntervention(intervention.id, {
                                                        parameters: { ...intervention.parameters, target_station_id: e.target.value }
                                                    })}
                                                    className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded text-sm"
                                                >
                                                    {stationIds.map(id => (
                                                        <option key={id} value={id}>{id}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1.5 font-bold">New Charger Count</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={intervention.parameters.new_count}
                                                    onChange={(e) => updateIntervention(intervention.id, {
                                                        parameters: { ...intervention.parameters, new_count: parseInt(e.target.value) }
                                                    })}
                                                    className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded text-sm font-mono"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {intervention.type === 'MODIFY_INVENTORY' && (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1.5 font-bold">Station</label>
                                                <select
                                                    value={intervention.parameters.target_station_id}
                                                    onChange={(e) => updateIntervention(intervention.id, {
                                                        parameters: { ...intervention.parameters, target_station_id: e.target.value }
                                                    })}
                                                    className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded text-sm"
                                                >
                                                    {stationIds.map(id => (
                                                        <option key={id} value={id}>{id}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1.5 font-bold">
                                                    Battery Change
                                                    <span className="text-gray-600 ml-1">(+5 = add 5 batteries)</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    min="-50"
                                                    max="50"
                                                    value={intervention.parameters.delta}
                                                    onChange={(e) => updateIntervention(intervention.id, {
                                                        parameters: { ...intervention.parameters, delta: parseInt(e.target.value) }
                                                    })}
                                                    className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded text-sm font-mono"
                                                    placeholder="e.g., +10 or -5"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {intervention.type === 'DEMAND_MULTIPLIER' && (
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs text-gray-400 font-bold">Demand Multiplier</label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-mono text-neon-green font-bold">{intervention.parameters.multiplier}x</span>
                                                    <span className="text-xs text-gray-500">
                                                        ({intervention.parameters.multiplier > 1 ? '+' : ''}{((intervention.parameters.multiplier - 1) * 100).toFixed(0)}%)
                                                    </span>
                                                </div>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="3.0"
                                                step="0.1"
                                                value={intervention.parameters.multiplier}
                                                onChange={(e) => updateIntervention(intervention.id, {
                                                    parameters: { ...intervention.parameters, multiplier: parseFloat(e.target.value) }
                                                })}
                                                className="w-full accent-neon-green h-2"
                                            />
                                            <div className="flex justify-between text-xs text-gray-600 mt-1">
                                                <span>0.5x (50% drop)</span>
                                                <span>1.0x (normal)</span>
                                                <span>3.0x (3x surge)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {interventions.length > 0 && (
                <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded p-3 text-xs text-gray-300">
                    <div className="font-bold text-neon-green mb-1">✅ {interventions.length} intervention(s) ready</div>
                    Enable "Scenario Mode" in the RUN tab, then click "Run Simulation" to apply these changes.
                </div>
            )}
        </div>
    );
}
