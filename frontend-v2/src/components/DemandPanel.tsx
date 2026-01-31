import { useMemo } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { BarChart3, Info, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function DemandPanel() {
    const { demandCurve, demandMultiplier, setDemandMultiplier } = useSimulationStore();

    // Format data for Recharts
    const chartData = useMemo(() => {
        return demandCurve.map((baseValue, index) => {
            const adjustedValue = Math.round(baseValue * demandMultiplier);
            return {
                hour: `${index}:00`,
                hourInt: index,
                base: baseValue,
                value: adjustedValue,
                isPeak: adjustedValue > 80 // Example threshold
            };
        });
    }, [demandCurve, demandMultiplier]);

    // Calculate daily total
    const totalSwaps = useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.value, 0);
    }, [chartData]);

    // Determine scenario description
    const scenarioDesc = useMemo(() => {
        if (demandMultiplier < 0.8) return { text: "Low Demand (e.g., Public Holiday)", color: "text-blue-400" };
        if (demandMultiplier > 1.2) return { text: "High Demand (e.g., Festival/Rain)", color: "text-amber-400" };
        return { text: "Standard Operating Day", color: "text-gray-400" };
    }, [demandMultiplier]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-neon-blue mb-2">
                <BarChart3 size={16} />
                <h3 className="font-bold text-sm uppercase tracking-wider">Demand Intelligence</h3>
            </div>

            {/* Controls */}
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Demand Multiplier</label>
                    <span className="text-lg font-mono font-bold text-neon-green">{demandMultiplier.toFixed(1)}x</span>
                </div>

                <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={demandMultiplier}
                    onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
                    className="w-full mb-4 accent-neon-green h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                />

                <div className={`text-xs flex items-center gap-2 ${scenarioDesc.color} bg-black/20 p-2 rounded justify-center`}>
                    <Info size={12} />
                    {scenarioDesc.text}
                </div>
            </div>

            {/* Dynamic Graph */}
            <div className="h-64 relative bg-neutral-900/50 rounded-lg border border-neutral-700 p-2">
                <div className="absolute top-3 left-4 right-4 flex justify-between z-10">
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Forecast Curve</div>
                    <div className="text-xs font-mono text-neon-blue">{totalSwaps.toLocaleString()} Est. Swaps</div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 30, right: 10, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#66fcf1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#66fcf1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="hourInt"
                            stroke="#666"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(val) => val % 6 === 0 ? `${val}:00` : ''}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-neutral-900 border border-neutral-600 p-2 rounded shadow-xl text-xs">
                                            <div className="text-gray-400 mb-1">{payload[0].payload.hour}</div>
                                            <div className="text-neon-green font-bold text-lg">
                                                {payload[0].value} <span className="text-xs font-normal text-gray-500">swaps</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#66fcf1"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            animationDuration={300}
                        />
                        {/* Peak Demand Line */}
                        <ReferenceLine y={40 * demandMultiplier} stroke="#ff003c" strokeDasharray="3 3" opacity={0.5}>
                            {/* <Label value="Peak Cap" position="insideTopLeft" fill="#ff003c" fontSize={10} /> */}
                        </ReferenceLine>
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-800 p-3 rounded border border-neutral-700">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Daily Total
                    </div>
                    <div className="text-xl font-bold text-white">{totalSwaps.toLocaleString()}</div>
                </div>
                <div className="bg-neutral-800 p-3 rounded border border-neutral-700">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <TrendingUp size={12} /> Peak Load
                    </div>
                    <div className="text-xl font-bold text-white">
                        {Math.max(...chartData.map(d => d.value))} <span className="text-xs font-normal text-gray-500">/hr</span>
                    </div>
                </div>
            </div>

            {demandMultiplier > 1.5 && (
                <div className="flex gap-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded text-amber-200 text-xs">
                    <AlertTriangle size={16} className="shrink-0" />
                    <div>
                        <span className="font-bold">Grid Warning:</span> High demand may cause battery stockouts in Sector 5. Consider adding mobile chargers.
                    </div>
                </div>
            )}
        </div>
    );
}
