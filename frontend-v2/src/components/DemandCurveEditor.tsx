import { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface DemandCurveEditorProps {
    demandCurve: number[];
    onChange: (curve: number[]) => void;
}

export default function DemandCurveEditor({ demandCurve, onChange }: DemandCurveEditorProps) {
    const [showFineTune, setShowFineTune] = useState(false);

    const applyPattern = (pattern: string) => {
        let newCurve: number[];
        switch (pattern) {
            case 'flat':
                newCurve = Array(24).fill(20);
                break;
            case 'morning_peak':
                newCurve = [5, 3, 2, 2, 3, 6, 12, 25, 35, 30, 25, 20, 15, 18, 20, 22, 28, 40, 45, 38, 25, 15, 10, 7];
                break;
            case 'evening_peak':
                newCurve = [8, 5, 3, 2, 3, 5, 10, 15, 20, 18, 15, 12, 10, 12, 15, 20, 30, 45, 50, 40, 30, 20, 15, 10];
                break;
            case 'festival':
                newCurve = [10, 8, 6, 5, 6, 10, 18, 30, 40, 35, 30, 25, 20, 25, 30, 35, 45, 60, 70, 55, 40, 25, 18, 12];
                break;
            default:
                newCurve = demandCurve;
        }
        onChange(newCurve);
    };

    const updatePeriod = (periodStart: number, value: number) => {
        const newCurve = [...demandCurve];
        for (let i = periodStart; i < periodStart + 4 && i < 24; i++) {
            newCurve[i] = Math.max(0, value);
        }
        onChange(newCurve);
    };

    const maxValue = Math.max(...demandCurve, 1);
    const avgValue = (demandCurve.reduce((a, b) => a + b, 0) / 24);
    const totalDaily = demandCurve.reduce((a, b) => a + b, 0);
    const expectedSwaps = Math.round(totalDaily * 0.95);

    const periods = [
        { name: 'Night', hours: '0-4', start: 0, icon: '🌙' },
        { name: 'Early Morning', hours: '4-8', start: 4, icon: '🌅' },
        { name: 'Morning', hours: '8-12', start: 8, icon: '☀️' },
        { name: 'Afternoon', hours: '12-16', start: 12, icon: '🌤️' },
        { name: 'Evening', hours: '16-20', start: 16, icon: '🌆' },
        { name: 'Night', hours: '20-24', start: 20, icon: '🌃' },
    ];

    return (
        <div className="space-y-5">
            {/* Title */}
            <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-neon-green" />
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">24-Hour Demand Pattern</h2>
            </div>

            {/* Quick Patterns */}
            <div>
                <h3 className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">Quick Patterns</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => applyPattern('flat')}
                        className="group bg-gradient-to-br from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-600 hover:border-neon-blue text-white px-4 py-4 rounded-lg transition-all text-left shadow-md hover:shadow-neon-blue/20"
                    >
                        <div className="font-bold text-sm mb-1">Flat</div>
                        <div className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">Constant 20/hr</div>
                    </button>
                    <button
                        onClick={() => applyPattern('morning_peak')}
                        className="group bg-gradient-to-br from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-600 hover:border-neon-blue text-white px-4 py-4 rounded-lg transition-all text-left shadow-md hover:shadow-neon-blue/20"
                    >
                        <div className="font-bold text-sm mb-1">Morning Rush</div>
                        <div className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">Peak 8-10am</div>
                    </button>
                    <button
                        onClick={() => applyPattern('evening_peak')}
                        className="group bg-gradient-to-br from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-600 hover:border-neon-blue text-white px-4 py-4 rounded-lg transition-all text-left shadow-md hover:shadow-neon-blue/20"
                    >
                        <div className="font-bold text-sm mb-1">Evening Rush</div>
                        <div className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">Peak 5-7pm</div>
                    </button>
                    <button
                        onClick={() => applyPattern('festival')}
                        className="group bg-gradient-to-br from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-600 hover:border-neon-blue text-white px-4 py-4 rounded-lg transition-all text-left shadow-md hover:shadow-neon-blue/20"
                    >
                        <div className="font-bold text-sm mb-1">Festival Surge</div>
                        <div className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">High all day</div>
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-gradient-to-r from-neutral-800/50 to-neutral-900/50 border border-neutral-700 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400 font-medium">Arrivals per Hour</div>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500">Peak:</span>
                            <span className="text-neon-green font-mono font-bold text-lg">{maxValue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500">Avg:</span>
                            <span className="text-neon-blue font-mono font-bold text-lg">{avgValue.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Beautiful Bar Chart */}
            <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 rounded-xl p-6 shadow-xl">
                <div className="relative">
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {[100, 75, 50, 25, 0].map((percent) => (
                            <div key={percent} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-600 font-mono w-8 text-right">
                                    {Math.round((maxValue * percent) / 100)}
                                </span>
                                <div className="flex-1 border-t border-neutral-700/50 border-dashed"></div>
                            </div>
                        ))}
                    </div>

                    {/* Bars */}
                    <div className="relative flex items-end gap-0.5 h-48 pt-2">
                        {demandCurve.map((value, hour) => {
                            const heightPercent = (value / maxValue) * 100;
                            const isHighDemand = value > avgValue * 1.3;
                            const isMediumDemand = value > avgValue * 0.7 && value <= avgValue * 1.3;

                            return (
                                <div
                                    key={hour}
                                    className="flex-1 flex flex-col items-center group relative"
                                >
                                    {/* Tooltip */}
                                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-neon-blue/50">
                                        <div className="font-bold text-neon-blue">{hour}:00</div>
                                        <div className="text-gray-300">{value} arrivals/hr</div>
                                    </div>

                                    {/* Bar */}
                                    <div
                                        className={`w-full rounded-t-sm transition-all duration-300 group-hover:scale-110 cursor-pointer ${isHighDemand
                                                ? 'bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 shadow-lg shadow-orange-500/50'
                                                : isMediumDemand
                                                    ? 'bg-gradient-to-t from-neon-blue via-cyan-400 to-cyan-300 shadow-md shadow-neon-blue/30'
                                                    : 'bg-gradient-to-t from-green-700 via-green-500 to-green-400 shadow-sm shadow-green-500/20'
                                            }`}
                                        style={{
                                            height: `${heightPercent}%`,
                                            minHeight: value > 0 ? '6px' : '2px',
                                            opacity: value > 0 ? 1 : 0.15
                                        }}
                                    />

                                    {/* Hour Label */}
                                    {hour % 3 === 0 && (
                                        <div className="text-[10px] text-gray-500 mt-2 font-mono font-bold">
                                            {hour.toString().padStart(2, '0')}:00
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-4 mt-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-green-700 to-green-400"></div>
                        <span className="text-gray-400">Low (&lt;0.7× avg)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-neon-blue to-cyan-300"></div>
                        <span className="text-gray-400">Normal (0.7-1.3× avg)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-red-600 to-yellow-400"></div>
                        <span className="text-gray-400">High (&gt;1.3× avg)</span>
                    </div>
                </div>
            </div>

            {/* Fine-tune Section */}
            <div className="border-t border-neutral-700 pt-4">
                <button
                    onClick={() => setShowFineTune(!showFineTune)}
                    className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors py-2 px-3 rounded hover:bg-neutral-800/50"
                >
                    <span className="uppercase tracking-wider font-bold">Fine-tune by Time Period</span>
                    {showFineTune ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showFineTune && (
                    <div className="space-y-3 mt-4">
                        {periods.map((period) => {
                            const avgForPeriod = Math.round(
                                demandCurve.slice(period.start, period.start + 4).reduce((a, b) => a + b, 0) / 4
                            );

                            return (
                                <div key={period.start} className="bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 rounded-lg p-4 shadow-md">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{period.icon}</span>
                                            <div>
                                                <div className="text-sm font-bold text-white">{period.name}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">{period.hours}</div>
                                            </div>
                                        </div>
                                        <div className="text-lg font-mono text-neon-green font-bold">{avgForPeriod}<span className="text-xs text-gray-500 ml-1">/hr</span></div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="80"
                                        value={avgForPeriod}
                                        onChange={(e) => updatePeriod(period.start, parseInt(e.target.value))}
                                        className="w-full accent-neon-green h-2 rounded-full"
                                        style={{
                                            background: `linear-gradient(to right, #66fcf1 0%, #66fcf1 ${(avgForPeriod / 80) * 100}%, #374151 ${(avgForPeriod / 80) * 100}%, #374151 100%)`
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Daily Summary - Enhanced */}
            <div className="bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border border-neutral-700 rounded-xl p-5 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-gradient-to-b from-neon-green to-neon-blue rounded-full"></div>
                    <h3 className="text-xs text-gray-400 uppercase tracking-wider font-bold">Daily Summary</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Total Daily Arrivals</div>
                        <div className="text-4xl font-mono text-white font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            {totalDaily}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Expected Swaps/Day</div>
                        <div className="text-4xl font-mono font-bold bg-gradient-to-r from-neon-green to-neon-blue bg-clip-text text-transparent">
                            ~{expectedSwaps}
                        </div>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-700/50">
                    <div className="text-xs text-gray-600 text-center">
                        Assuming 95% success rate • Updated in real-time
                    </div>
                </div>
            </div>
        </div>
    );
}
