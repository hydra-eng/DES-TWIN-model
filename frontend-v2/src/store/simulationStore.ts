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
}

export const useSimulationStore = create<SimulationState>((set) => ({
    isRunning: false,
    stats: null,
    result: null,
    error: null,

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
}));
