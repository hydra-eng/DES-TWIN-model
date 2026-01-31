import { create } from 'zustand';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/v1';

interface SimulationState {
    isRunning: boolean;
    stats: any | null;
    result: any | null;
    error: string | null;

    fetchStats: () => Promise<void>;
    setRunning: (running: boolean) => void;
    setResult: (result: any) => void;
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
};

const DEFAULT_STATIONS: Station[] = [
    {
        id: "downtown",
        name: "Downtown Hub",
        location: { lat: 28.6139, lon: 77.2090 },
        total_batteries: 25,
        charger_count: 6,
        charge_power_kw: 60.0,
        swap_time_seconds: 90,
        position: [77.2090, 28.6139],
        color: [69, 162, 158], // #45a29e
        radius: 200
    },
    {
        id: "sector5",
        name: "Sector 5 Station",
        location: { lat: 28.5900, lon: 77.2100 },
        total_batteries: 15,
        charger_count: 4,
        charge_power_kw: 60.0,
        swap_time_seconds: 90,
        position: [77.2100, 28.5900],
        color: [69, 162, 158],
        radius: 200
    }
];

export const useSimulationStore = create<SimulationState>((set) => ({
    isRunning: false,
    stats: null,
    result: null,
    error: null,

    // Initial State
    stations: DEFAULT_STATIONS,
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
