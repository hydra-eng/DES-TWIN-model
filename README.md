# Digital Twin Swap Station Simulation

This repository contains the simulation engine and visualization dashboard for a city-wide battery swap station network.

## Project Structure

- **backend/**: Python/FastAPI backend for running the simulation engine, optimization algorithms, and serving the API.
- **frontend-v2/**: React/Vite frontend for visualizing the simulation in real-time.

## Getting Started

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment:
   ```bash
   cp .env.example .env
   ```
5. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend-v2
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Features

- Real-time simulation of battery swapping demand.
- Optimization of battery stock at stations.
- Interactive map visualization.
