# Digital Twin Battery Swap Network Simulation

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![React](https://img.shields.io/badge/react-18+-61DAFB.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)

## 📖 Overview

The **Digital Twin Swap Station Simulation** is a high-fidelity decision-support tool designed to model, analyze, and optimize city-wide battery swapping networks. 

Traditional planning for battery swap infrastructure relies on static spreadsheets that fail to capture complex queuing dynamics, grid constraints, and stochastic demand. This project solves that by building a **Discrete Event Simulation (DES)** engine that creates a "Digital Twin" of the network.

**Key Capabilities:**
*   **Hyper-Realistic Simulation:** Models station physics, including non-linear charging curves, bay occupancy, and battery cooling times.
*   **What-If Analysis:** Allows operations teams to simulate interventions (e.g., "What if we add 2 chargers to Station A?") and measure impact before spending capital.
*   **Visual Dashboard:** Interactive map-based visualization to monitor network KPIs like wait times, stockouts, and charger utilization.

---

## 🏗️ Architecture

The system is built as a modern full-stack application:

### **Backend (The Simulation Engine)**
*   **Core Logic:** Python & `SimPy` for discrete-event simulation.
*   **API:** `FastAPI` for high-performance REST endpoints.
*   **Features:**
    *   Poisson process arrival generation with hourly demand curves.
    *   Detailed battery state tracking (SoC, health, cycle count).
    *   A/B Scenario comparison engine.

### **Frontend (The Command Center)**
*   **Framework:** React + Vite (TypeScript).
*   **Visualization:** `Deck.gl` & `MapLibre` for rendering high-performance map layers.
*   **State Management:** `Zustand` for managing simulation configurations and results.

---

## 🚀 Getting Started

### Prerequisites
*   Python 3.11+
*   Node.js 18+

### 1. Backend Setup
The backend runs the physics engine and serves the API.

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload
```
*Server will start at `http://127.0.0.1:8000`*

### 2. Frontend Setup
The frontend provides the interactive dashboard.

```bash
cd frontend-v2

# Install dependencies
npm install

# Start development server
npm run dev
```
*Dashboard will launch at `http://localhost:5173`*

---

## 🧪 How It Works (Step-by-Step)

We are building this system in layers to ensure accuracy and scalability:

### **Phase 1: The Physics Core (Current Status)**
We have implemented the fundamental laws of the network:
1.  **Station Logic:** Modeled as a `G/G/k` queue. Vehicles arrive, request a charged battery, and swap if available.
2.  **Battery Lifecycle:** Batteries cycle through `Available` -> `Swapped` -> `Depleted` -> `Charging` (Non-linear curve) -> `Available`.
3.  **Telemetry:** Every event (arrival, swap, charge start) is logged with microsecond precision.

### **Phase 2: Scenario Engine**
We enable "Counterfactual Analysis":
*   Users can define a **Baseline** (current state) and a **Scenario** (proposed changes).
*   The engine runs both simulations with identical random seeds to isolate the impact of the intervention.
*   Metrics like "Lost Swaps" and "Average Wait Time" are compared directly.

### **Phase 3: Visualization & Optimization**
*   **Heatmaps:** Visualizing stations under stress (Red = High Wait Time).
*   **Optimization Algorithms:** (Coming Soon) Automatically recommending the optimal distribution of batteries across the city to minimize cost.

---

## 📂 Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── simulation/    # SimPy core logic (engine.py, assets.py)
│   │   ├── api/           # FastAPI routes
│   │   └── schemas/       # Pydantic data models
│   └── ...
└── frontend-v2/
    ├── src/
    │   ├── components/    # React UI components (MapViz, StationManager)
    │   └── store/         # State management
    └── ...
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.