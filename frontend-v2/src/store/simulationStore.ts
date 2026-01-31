import { create } from 'zustand';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/v1';

interface SimulationStats {
    database_pool: Record<string, number>;
    settings: {
        max_duration_days: number;
        default_seed: number;
    };
}

interface SimulationResult {
    run_id: string;
    city_total_swaps: number;
    city_lost_swaps: number;
    city_avg_wait_time: number;
    city_throughput_per_hour: number;
    estimated_opex_cost: number;
    avg_charger_utilization: number;
    avg_idle_inventory_pct: number;
    baseline_comparison?: {
        wait_time_delta_pct: number;
        lost_swaps_delta: number;
        throughput_delta_pct: number;
        opex_delta: number;
        utilization_delta_pct: number;
    };
    opex_breakdown?: {
        energy_cost: number;
        depreciation_cost: number;
        logistics_cost: number;
        total: number;
    };
    station_kpis: any[]; // Keep any for nested KPI for now or define deeper
}

interface SimulationState {
    isRunning: boolean;
    stats: SimulationStats | null;
    result: SimulationResult | null;
    error: string | null;

    fetchStats: () => Promise<void>;
    fetchStations: () => Promise<void>;
    setRunning: (running: boolean) => void;
    setResult: (result: SimulationResult) => void;
    stations: Station[];
    demandCurve: number[];
    demandMultiplier: number;

    setStations: (stations: Station[] | ((prev: Station[]) => Station[])) => void;
    setDemandCurve: (curve: number[]) => void;
    setDemandMultiplier: (multiplier: number) => void;
}

export type Station = {
    id: string;
    name: string;
    location: { lat: number; lon: number };
    total_batteries: number;
    charger_count: number;
    charge_power_kw: number;
    swap_time_seconds: number;
    position?: [number, number]; // Derived for DeckGL
    color?: [number, number, number]; // Derived for DeckGL
    radius?: number; // Derived for DeckGL
    type?: 'CORE' | 'SCENARIO'; // Protection flag
    status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
};

export const useSimulationStore = create<SimulationState>((set) => ({
    isRunning: false,
    stats: null,
    result: null,
    error: null,

    // Initial State - Empty by default, fetched from API
    stations: [],
    demandCurve: [5, 3, 2, 2, 3, 6, 12, 25, 35, 30, 25, 20, 15, 18, 20, 22, 28, 40, 45, 38, 25, 15, 10, 7],
    demandMultiplier: 1.0,

    fetchStats: async () => {
        try {
            const response = await axios.get(`${API_URL}/stats`);
            set({ stats: response.data, error: null });
        } catch (err) {
            set({ error: 'Failed to fetch stats from backend' });
            console.error(err);
        }
    },

    fetchStations: async () => {
        try {
            const response = await axios.get(`${API_URL}/stations`);
            // Pre-process stations if needed (e.g. add missing props)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loadedStations = response.data.map((s: any) => ({
                ...s,
                type: s.type || 'CORE' // Default to CORE if from API
            }));
            set({ stations: loadedStations, error: null });
        } catch (err) {
            console.error('Failed to fetch stations:', err);
            // Don't overwrite error if it's just initial load failure? 
            // Better to log.
        }
    },

    setRunning: (running) => set({ isRunning: running }),
    setResult: (result) => set({ result }),

    setStations: (stationsOrUpdater) => set((state) => {
        const newStations = typeof stationsOrUpdater === 'function'
            ? stationsOrUpdater(state.stations)
            : stationsOrUpdater;
        return { stations: newStations };
    }),

    setDemandCurve: (curve) => set({ demandCurve: curve }),
    setDemandMultiplier: (multiplier) => set({ demandMultiplier: multiplier }),
}));
