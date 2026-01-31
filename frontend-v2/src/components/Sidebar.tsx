import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Play, Loader, Settings, TrendingUp, Building2, BarChart3, Zap } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';
import DemandCurveEditor from './DemandCurveEditor';
import StationManager from './StationManager';
import InterventionBuilder from './InterventionBuilder';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/v1';

type TabType = 'run' | 'demand' | 'stations' | 'interventions';

export default function Sidebar() {
    const { stats, error, fetchStats, setResult, result } = useSimulationStore();
    const [activeTab, setActiveTab] = useState<TabType>('run');
    const [simRunning, setSimRunning] = useState(false);
    const [simError, setSimError] = useState<string | null>(null);

    // Configuration State
    const [duration, setDuration] = useState(1);
    const [demandMultiplier, setDemandMultiplier] = useState(1.0);
    const [scenarioName, setScenarioName] = useState('baseline');
    const [useScenario, setUseScenario] = useState(false);

    // Demand Curve (24-hour pattern)
    const [demandCurve, setDemandCurve] = useState<number[]>([
        5, 3, 2, 2, 3, 6, 12, 25, 35, 30, 25, 20, 15, 18, 20, 22, 28, 40, 45, 38, 25, 15, 10, 7
    ]);

    // Station Configuration
    const [stations, setStations] = useState([
        {
            id: "downtown",
            name: "Downtown Hub",
            location: { lat: 28.6139, lon: 77.2090 },
            total_batteries: 25,
            charger_count: 6,
            charge_power_kw: 60.0,
            swap_time_seconds: 90
        },
        {
            id: "sector5",
            name: "Sector 5 Station",
            location: { lat: 28.5900, lon: 77.2100 },
            total_batteries: 15,
            charger_count: 4,
            charge_power_kw: 60.0,
            swap_time_seconds: 90
        }
    ]);

    // Interventions
    const [interventions, setInterventions] = useState<any[]>([]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const runSimulation = async () => {
        setSimRunning(true);
        setSimError(null);

        const config: any = {
            duration_days: duration,
            random_seed: 42,
            demand_multiplier: demandMultiplier,
            stations: stations,
            demand_curve: {
                base_arrivals_per_hour: demandCurve,
                multipliers: {}
            }
        };

        // Add scenario if enabled (even with no interventions)
        if (useScenario) {
            config.scenario = {
                name: scenarioName || 'custom_scenario',
                description: "Custom scenario configuration",
                interventions: interventions.length > 0 ? interventions.map(int => ({
                    type: int.type,
                    target_station_id: int.parameters.target_station_id,
                    parameters: int.parameters
                })) : []
            };
        }

        try {
            console.log('Sending config:', JSON.stringify(config, null, 2));
            const response = await axios.post(`${API_URL}/start`, config);
            console.log('Response:', response.data);
            setResult(response.data);
            setActiveTab('run'); // Switch to results tab
        } catch (err: any) {
            console.error('Simulation error:', err);
            const errorMsg = err.response?.data?.detail || err.message || 'Simulation failed';
            setSimError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setSimRunning(false);
        }
    };

    return (
        <div className="w-full h-screen bg-neutral-900 border-r border-neutral-700 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-neutral-700">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-neon-green to-neon-blue bg-clip-text text-transparent">
                    Digital Twin
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Swap Station Sandbox</p>
            </div>

            {/* Connection Status */}
            <div className="px-6 py-4 border-b border-neutral-700">
                <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                    {error ? (
                        <div className="flex items-center gap-2 text-red-400">
                            <AlertTriangle size={18} />
                            <div>
                                <div className="font-bold text-xs">Connection Error</div>
                                <div className="text-xs mt-1 text-gray-400">{error}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle size={18} />
                            <div>
                                <div className="font-bold text-xs">Connected</div>
                                <div className="text-xs mt-1 text-gray-400">Backend Online</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-700">
                <button
                    onClick={() => setActiveTab('run')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'run'
                        ? 'bg-neutral-800 text-neon-green border-b-2 border-neon-green'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Play size={14} />
                    Run
                </button>
                <button
                    onClick={() => setActiveTab('demand')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'demand'
                        ? 'bg-neutral-800 text-neon-green border-b-2 border-neon-green'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <BarChart3 size={14} />
                    Demand
                </button>
                <button
                    onClick={() => setActiveTab('stations')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'stations'
                        ? 'bg-neutral-800 text-neon-green border-b-2 border-neon-green'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Building2 size={14} />
                    Stations
                </button>
                <button
                    onClick={() => setActiveTab('interventions')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'interventions'
                        ? 'bg-neutral-800 text-neon-green border-b-2 border-neon-green'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Zap size={14} />
                    Interventions
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'run' && (
                    <div className="p-6 space-y-6">
                        {/* Basic Config */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-neon-blue mb-4">
                                <Settings size={16} />
                                <h3 className="font-bold text-sm uppercase tracking-wider">Quick Settings</h3>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 block mb-2">Duration (Days)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value))}
                                    className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded focus:outline-none focus:border-neon-blue"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-gray-400">Global Multiplier</label>
                                    <span className="text-sm font-mono text-neon-green">{demandMultiplier.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={demandMultiplier}
                                    onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
                                    className="w-full accent-neon-green"
                                />
                            </div>

                            <div className="bg-neutral-800 border border-neutral-700 rounded p-3">
                                <div className="flex items-center gap-3 mb-2">
                                    <input
                                        type="checkbox"
                                        id="useScenario"
                                        checked={useScenario}
                                        onChange={(e) => setUseScenario(e.target.checked)}
                                        className="w-4 h-4 accent-neon-blue"
                                    />
                                    <label htmlFor="useScenario" className="text-sm text-white font-bold cursor-pointer">
                                        Enable Scenario Mode
                                    </label>
                                </div>
                                {!useScenario && (
                                    <div className="text-xs text-gray-500 ml-7">
                                        Turn this on to apply interventions from the INTERVENTIONS tab
                                    </div>
                                )}
                                {useScenario && (
                                    <div className="mt-3 space-y-2">
                                        <input
                                            type="text"
                                            value={scenarioName}
                                            onChange={(e) => setScenarioName(e.target.value)}
                                            placeholder="e.g., diwali_surge, peak_hour_test"
                                            className="w-full bg-neutral-900 border border-neutral-600 text-white px-3 py-2 rounded focus:outline-none focus:border-neon-blue text-sm"
                                        />
                                        <div className="text-xs text-gray-400 bg-blue-900/20 border border-blue-500/30 rounded px-2 py-1.5">
                                            {interventions.length === 0 ? (
                                                <>⚠️ No interventions added. Go to INTERVENTIONS tab to add what-if changes.</>
                                            ) : (
                                                <>✅ {interventions.length} intervention(s) will be applied</>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Run Button */}
                        <button
                            className="w-full bg-gradient-to-r from-neon-blue to-neon-green hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded transition-all flex items-center justify-center gap-2 shadow-lg"
                            onClick={runSimulation}
                            disabled={simRunning}
                        >
                            {simRunning ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play size={20} />
                                    Run Simulation
                                </>
                            )}
                        </button>

                        {simError && (
                            <div className="p-4 bg-red-900/30 border-2 border-red-500 rounded text-red-400 text-xs">
                                <div className="font-bold mb-2 text-red-300">❌ Simulation Failed</div>
                                <pre className="whitespace-pre-wrap text-xs">{simError}</pre>
                            </div>
                        )}

                        {/* Results */}
                        {result && (
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp size={14} />
                                    Performance Impact
                                </h3>

                                <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-neutral-900 text-gray-400 text-xs uppercase">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Metric</th>
                                                <th className="px-3 py-2 font-medium text-right">Value</th>
                                                <th className="px-3 py-2 font-medium text-right">vs Baseline</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-700">
                                            <tr>
                                                <td className="px-3 py-2 text-gray-300">Avg Wait Time</td>
                                                <td className="px-3 py-2 text-right font-mono text-white">
                                                    {result.city_avg_wait_time?.toFixed(1)}s
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {result.baseline_comparison ? (
                                                        <span className={result.baseline_comparison.wait_time_delta_pct < 0 ? "text-neon-green" : "text-red-400"}>
                                                            {result.baseline_comparison.wait_time_delta_pct > 0 ? "+" : ""}
                                                            {result.baseline_comparison.wait_time_delta_pct}%
                                                        </span>
                                                    ) : <span className="text-gray-600">-</span>}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 text-gray-300">Lost Swaps</td>
                                                <td className="px-3 py-2 text-right font-mono text-white">
                                                    {result.city_lost_swaps}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {result.baseline_comparison ? (
                                                        <span className={result.baseline_comparison.lost_swaps_delta <= 0 ? "text-neon-green" : "text-red-400"}>
                                                            {result.baseline_comparison.lost_swaps_delta > 0 ? "+" : ""}
                                                            {result.baseline_comparison.lost_swaps_delta}
                                                        </span>
                                                    ) : <span className="text-gray-600">-</span>}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 text-gray-300">Utilisation</td>
                                                <td className="px-3 py-2 text-right font-mono text-white">
                                                    {(result.avg_charger_utilization * 100).toFixed(0)}%
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-gray-500">
                                                    -
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Cost Breakdown */}
                                {result.opex_breakdown && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                            <Zap size={14} />
                                            Cost Analysis (Daily)
                                        </h3>
                                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-3">
                                            <div className="flex justify-between items-end border-b border-neutral-700 pb-3">
                                                <span className="text-gray-300 text-sm">Total OpEx</span>
                                                <span className="text-xl font-bold text-white font-mono">
                                                    ₹{Math.round(result.opex_breakdown.total).toLocaleString()}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">⚡ Energy</span>
                                                    <span className="text-gray-300 font-mono">
                                                        ₹{Math.round(result.opex_breakdown.energy_cost).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">🔋 Depreciation</span>
                                                    <span className="text-gray-300 font-mono">
                                                        ₹{Math.round(result.opex_breakdown.depreciation_cost).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">🔧 Logistics & Fixed</span>
                                                    <span className="text-gray-300 font-mono">
                                                        ₹{Math.round(result.opex_breakdown.logistics_cost).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="text-xs text-gray-600 text-center pt-2">
                                    Computed in {result.compute_time_ms}ms • {result.scenario_name}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'demand' && (
                    <div className="p-6">
                        <DemandCurveEditor
                            demandCurve={demandCurve}
                            onChange={setDemandCurve}
                        />
                    </div>
                )}

                {activeTab === 'stations' && (
                    <div className="p-6">
                        <StationManager
                            stations={stations}
                            onChange={setStations}
                        />
                    </div>
                )}

                {activeTab === 'interventions' && (
                    <div className="p-6">
                        <InterventionBuilder
                            interventions={interventions}
                            onChange={setInterventions}
                            stationIds={stations.map(s => s.id)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
