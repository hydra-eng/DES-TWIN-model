-- Digital Twin Swap Station - Database Initialization
-- This script runs on first container startup

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_scenario_id UUID REFERENCES scenarios(id),
    config_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create simulation_runs table
CREATE TABLE IF NOT EXISTS simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID REFERENCES scenarios(id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    compute_time_ms INTEGER,
    result_summary JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create telemetry_events table (will be converted to hypertable)
CREATE TABLE IF NOT EXISTS telemetry_events (
    time TIMESTAMPTZ NOT NULL,
    run_id UUID NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    meta_data JSONB,
    PRIMARY KEY (time, run_id, entity_id, event_type)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('telemetry_events', 'time', if_not_exists => TRUE);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_telemetry_run_id ON telemetry_events (run_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_entity ON telemetry_events (entity_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON telemetry_events (event_type);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_status ON simulation_runs (status);

-- Create stations configuration table
CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255),
    location_lat DOUBLE PRECISION NOT NULL,
    location_lon DOUBLE PRECISION NOT NULL,
    total_batteries INTEGER NOT NULL,
    charger_count INTEGER NOT NULL,
    charge_power_kw DOUBLE PRECISION NOT NULL,
    swap_time_seconds INTEGER NOT NULL,
    grid_power_limit_kw DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE telemetry_events IS 'Hypertable for simulation event logging';
COMMENT ON TABLE scenarios IS 'What-if scenario configurations';
COMMENT ON TABLE simulation_runs IS 'Individual simulation execution records';
