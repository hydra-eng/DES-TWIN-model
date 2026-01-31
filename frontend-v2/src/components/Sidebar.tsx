import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Play, Loader, Settings, TrendingUp, Building2, BarChart3, Zap } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';
import StationManager from './StationManager';
import InterventionBuilder from './InterventionBuilder';
import DemandPanel from './DemandPanel';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/v1';

type TabType = 'run' | 'demand' | 'stations' | 'interventions';

export default function Sidebar() {
    // Store access
    const {
        error,
        fetchStats,
        setResult,
        result,
        stations,
        setStations,
        demandCurve,
        demandMultiplier
    } = useSimulationStore();

    const [activeTab, setActiveTab] = useState<TabType>('run');
    const [simRunning, setSimRunning] = useState(false);
    const [simError, setSimError] = useState<string | null>(null);

    // Configuration State
    const [duration, setDuration] = useState(1);
    const [scenarioName, setScenarioName] = useState('baseline');
    const [useScenario, setUseScenario] = useState(false);

    // Interventions (keep local for now as they are scenario-specific)
    const [interventions, setInterventions] = useState<Array<{
        id: string;
        type: string;
        parameters: any;
    }>>([]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const runSimulation = async () => {
        setSimRunning(true);
        setSimError(null);

        const baseConfig = {
            duration_days: duration,
            random_seed: 42,
            demand_multiplier: demandMultiplier,
            stations: stations,
            demand_curve: {
                base_arrivals_per_hour: demandCurve,
                multipliers: {}
            }
        };

        try {
            let response;

            if (useScenario) {
                // Prepare Scenario Config
                const scenarioConfig = {
                    ...baseConfig,
                    scenario: {
                        name: scenarioName || 'custom_scenario',
                        description: "Custom scenario configuration",
                        interventions: interventions.length > 0 ? interventions.map(int => ({
                            type: int.type,
                            target_station_id: int.parameters.target_station_id,
                            parameters: int.parameters
                        })) : []
                    }
                };

                console.log('Running comparison...');
                response = await axios.post(`${API_URL}/compare`, {
                    baseline_config: baseConfig,
                    scenario_config: scenarioConfig
                });
            } else {
                // Run Single Simulation
                console.log('Running baseline...');
                response = await axios.post(`${API_URL}/start`, baseConfig);
            }

            console.log('Response:', response.data);
            setResult(response.data);
            setActiveTab('run');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Simulation error:', err);
            const errorMsg = err.response?.data?.detail || err.message || 'Simulation failed';
            setSimError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setSimRunning(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-neutral-900/80 backdrop-blur-md border-r border-white/10 shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-black/20">
                <h1 className="text-2xl font-black bg-gradient-to-r from-neon-green to-neon-blue bg-clip-text text-transparent">
                    DIGITAL TWIN
                </h1>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">
                    Strategy Sandbox v2.0
                </p>
            </div>

            {/* Connection Status & Quick Stats */}
            <div className="px-6 py-4 border-b border-white/5 space-y-3">
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${error ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                    {error ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle size={16} className="text-neon-green" />}
                    <div className="flex-1">
                        <div className={`text-xs font-bold uppercase tracking-wider ${error ? 'text-red-400' : 'text-neon-green'}`}>
                            {error ? 'System Offline' : 'System Online'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 p-2 bg-black/20 gap-1 overflow-x-auto">
                {[
                    { id: 'run', icon: Play, label: 'Run' },
                    { id: 'demand', icon: BarChart3, label: 'Demand' },
                    { id: 'stations', icon: Building2, label: 'Map' },
                    { id: 'interventions', icon: Zap, label: 'Edit' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab.id
                            ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30 shadow-[0_0_10px_rgba(102,252,241,0.1)]'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6 space-y-8">
                    {activeTab === 'run' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* Run Configuration */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-neon-blue">
                                    <Settings size={16} />
                                    <h3 className="font-bold text-xs uppercase tracking-wider">Simulation Config</h3>
                                </div>

                                <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-gray-400">Time Horizon</span>
                                            <span className="text-neon-green font-mono">{duration} Day(s)</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="7"
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value))}
                                            className="w-full accent-neon-green h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    {/* Scenario Toggle */}
                                    <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                                        <span className="text-xs font-bold text-gray-300">Custom Scenario</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={useScenario} onChange={(e) => setUseScenario(e.target.checked)} className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-neon-blue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neon-blue"></div>
                                        </label>
                                    </div>

                                    {useScenario && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                type="text"
                                                value={scenarioName}
                                                onChange={(e) => setScenarioName(e.target.value)}
                                                placeholder="Scenario Name..."
                                                className="w-full bg-black/20 border border-white/10 text-white text-xs px-3 py-2 rounded focus:border-neon-blue outline-none"
                                            />
                                            <div className="text-[10px] text-gray-500 italic">
                                                *Comparing vs Baseline (same seed)
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={runSimulation}
                                    disabled={simRunning}
                                    className="w-full group relative overflow-hidden bg-gradient-to-r from-neon-blue to-neon-green p-px rounded-xl"
                                >
                                    <div className="relative bg-black/80 hover:bg-black/40 transition-colors rounded-xl px-5 py-4 flex items-center justify-center gap-3">
                                        {simRunning ? <Loader className="animate-spin text-white" size={20} /> : <Play className="text-white fill-white" size={20} />}
                                        <span className="font-bold text-white uppercase tracking-wider text-sm">
                                            {simRunning ? 'Simulating...' : (useScenario ? 'Run Comparison' : 'Run Simulation')}
                                        </span>
                                    </div>
                                </button>
                                {simError && (
                                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-200">
                                        ⚠ {simError}
                                    </div>
                                )}
                            </section>

                            {/* Results Section */}
                            {result && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between text-neon-green">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} />
                                            <h3 className="font-bold text-xs uppercase tracking-wider">
                                                {result.baseline_comparison ? 'Impact Analysis' : 'Results Analysis'}
                                            </h3>
                                        </div>
                                        {result.baseline_comparison && (
                                            <div className="text-[10px] bg-neon-blue/10 px-2 py-0.5 rounded text-neon-blue border border-neon-blue/20">
                                                VS BASELINE
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Wait Time */}
                                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="text-[10px] text-gray-400 uppercase">Wait Time</div>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="text-xl font-mono text-white">
                                                    {result.city_avg_wait_time?.toFixed(0)}<span className="text-xs text-gray-500 ml-1">sec</span>
                                                </span>
                                            </div>
                                            {result.baseline_comparison && (
                                                <div className={`text-[10px] mt-1 font-bold ${result.baseline_comparison.wait_time_delta_pct > 0 ? 'text-red-400' : 'text-neon-green'}`}>
                                                    {result.baseline_comparison.wait_time_delta_pct > 0 ? '▲' : '▼'} {Math.abs(result.baseline_comparison.wait_time_delta_pct)}%
                                                </div>
                                            )}
                                        </div>

                                        {/* Lost Swaps */}
                                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="text-[10px] text-gray-400 uppercase">Lost Swaps</div>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className={`text-xl font-mono ${result.city_lost_swaps > 0 ? 'text-red-400' : 'text-neon-green'}`}>
                                                    {result.city_lost_swaps}
                                                </span>
                                            </div>
                                            {result.baseline_comparison && (
                                                <div className={`text-[10px] mt-1 font-bold ${result.baseline_comparison.lost_swaps_delta > 0 ? 'text-red-400' : 'text-neon-green'}`}>
                                                    {result.baseline_comparison.lost_swaps_delta > 0 ? '+' : ''}{result.baseline_comparison.lost_swaps_delta}
                                                </div>
                                            )}
                                        </div>

                                        {/* Throughput - NEW */}
                                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="text-[10px] text-gray-400 uppercase">Throughput</div>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="text-xl font-mono text-white">
                                                    {result.city_throughput_per_hour?.toFixed(1)}<span className="text-xs text-gray-500 ml-1">/hr</span>
                                                </span>
                                            </div>
                                            {result.baseline_comparison && (
                                                <div className={`text-[10px] mt-1 font-bold ${result.baseline_comparison.throughput_delta_pct < 0 ? 'text-red-400' : 'text-neon-green'}`}>
                                                    {result.baseline_comparison.throughput_delta_pct > 0 ? '▲' : '▼'} {Math.abs(result.baseline_comparison.throughput_delta_pct)}%
                                                </div>
                                            )}
                                        </div>

                                        {/* Utilization - NEW */}
                                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="text-[10px] text-gray-400 uppercase">Utilization</div>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="text-xl font-mono text-white">
                                                    {(result.avg_charger_utilization * 100).toFixed(0)}<span className="text-xs text-gray-500 ml-1">%</span>
                                                </span>
                                            </div>
                                            {result.baseline_comparison && (
                                                <div className="text-[10px] mt-1 font-bold text-gray-500">
                                                    {result.baseline_comparison.utilization_delta_pct > 0 ? '▲' : '▼'} {Math.abs(result.baseline_comparison.utilization_delta_pct)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inventory & OpEx */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="text-[10px] text-gray-400 uppercase">Idle Inventory</div>
                                            <div className="text-xl font-mono text-white mt-1">
                                                {(result.avg_idle_inventory_pct || 0).toFixed(0)}<span className="text-xs text-gray-500 ml-1">%</span>
                                            </div>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="text-[10px] text-gray-400 uppercase">Total OpEx</div>
                                            <div className="text-xl font-mono text-white mt-1">
                                                ₹{(result.estimated_opex_cost / 1000).toFixed(1)}k
                                            </div>
                                            {result.baseline_comparison && (
                                                <div className={`text-[10px] mt-1 font-bold ${result.baseline_comparison.opex_delta > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                                    {result.baseline_comparison.opex_delta > 0 ? '+' : ''}{(result.baseline_comparison.opex_delta / 1000).toFixed(1)}k
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Opex Breakdown */}
                                    {result.opex_breakdown && (
                                        <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-xl p-4">
                                            <div className="text-xs text-gray-400 uppercase mb-4">Cost Structure</div>
                                            <div className="space-y-2">
                                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
                                                    <div className="bg-blue-500 h-full" style={{ width: `${(result.opex_breakdown.energy_cost / result.opex_breakdown.total) * 100}%` }} title="Energy" />
                                                    <div className="bg-purple-500 h-full" style={{ width: `${(result.opex_breakdown.depreciation_cost / result.opex_breakdown.total) * 100}%` }} title="Depreciation" />
                                                    <div className="bg-yellow-500 h-full" style={{ width: `${(result.opex_breakdown.logistics_cost / result.opex_breakdown.total) * 100}%` }} title="Logistics" />
                                                </div>
                                                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Energy</span>
                                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" />Asset</span>
                                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />Ops</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}

                    {activeTab === 'demand' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <DemandPanel />
                        </div>
                    )}

                    {activeTab === 'stations' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <StationManager
                                stations={stations}
                                onChange={setStations}
                            />
                        </div>
                    )}

                    {activeTab === 'interventions' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <InterventionBuilder
                                interventions={interventions}
                                onChange={setInterventions}
                                stationIds={stations.map(s => s.id)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-black/40 text-[10px] text-gray-600 text-center font-mono">
                SIM-ID: {Math.random().toString(36).substring(7).toUpperCase()}
            </div>
        </div>
    );
}
