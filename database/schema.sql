-- ============================================================================
-- Pulse · Emergency Transit & Preemption System
-- Team T079 | DBMS & Operating Systems PBL Project
-- Database Schema Definition (DDL)
-- Compatible with MySQL 8.0+, PostgreSQL 14+, and SQLite 3+
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VEHICLES TABLE
-- Stores emergency response fleet data and real-time operational status
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_sign VARCHAR(50) NOT NULL UNIQUE,              -- e.g. '108 Ambulance A-12'
    unit_label VARCHAR(30) NOT NULL,                    -- e.g. 'Ambulance A-12'
    vehicle_type VARCHAR(40) NOT NULL,                  -- 'Medical Trauma Unit', 'Police Interceptor', 'Fire Tender', 'Bike Medic'
    registration_no VARCHAR(20) NOT NULL UNIQUE,        -- e.g. 'MH-01-EQ-1082'
    driver_name VARCHAR(100) NOT NULL,                  -- Primary driver / pilot
    crew_member VARCHAR(100),                           -- Paramedic / EMT / Sub-Inspector
    status VARCHAR(25) NOT NULL DEFAULT 'AVAILABLE',    -- 'AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'MAINTENANCE'
    base_station VARCHAR(100) NOT NULL,                 -- e.g. 'Santacruz Fire & Medical Station'
    max_speed_kmh INTEGER NOT NULL DEFAULT 120,
    equipment_summary TEXT,                             -- e.g. 'Life Support Trauma · 5000L Foam Cannon'
    current_lat DECIMAL(10, 6) DEFAULT 19.0760,         -- Mumbai coordinates
    current_lng DECIMAL(10, 6) DEFAULT 72.8777,
    last_speed_kmh INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);

-- ----------------------------------------------------------------------------
-- 2. TRAFFIC SIGNALS / INTERSECTIONS TABLE
-- Stores traffic junctions with preemption state and automated cycle timing
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS traffic_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_code VARCHAR(30) NOT NULL UNIQUE,            -- e.g. 'SIG-MUM-01'
    name VARCHAR(100) NOT NULL,                         -- e.g. 'Bandra Kalanagar Signal #1'
    corridor_name VARCHAR(100) NOT NULL,                -- e.g. 'Western Express Highway Corridor'
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    default_cycle_sec INTEGER NOT NULL DEFAULT 90,      -- Standard cycle duration in seconds
    current_state VARCHAR(20) NOT NULL DEFAULT 'RED',   -- 'GREEN', 'YELLOW', 'RED', 'PREEMPTED'
    is_preempted BOOLEAN NOT NULL DEFAULT 0,            -- 1 = Preemption Active, 0 = Normal Cycle
    preempted_by_vehicle_id INTEGER,                    -- Foreign key to vehicle currently holding green
    override_mode VARCHAR(25) NOT NULL DEFAULT 'AUTO',  -- 'AUTO', 'MANUAL_GREEN', 'HOLD_ALL_RED'
    proximity_threshold_meters INTEGER DEFAULT 150,     -- Trigger distance for automated green wave
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (preempted_by_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_signals_preempted ON traffic_signals(is_preempted);
CREATE INDEX IF NOT EXISTS idx_signals_corridor ON traffic_signals(corridor_name);

-- ----------------------------------------------------------------------------
-- 3. INCIDENTS TABLE
-- Records incoming emergency alerts requiring rapid dispatch
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_code VARCHAR(30) NOT NULL UNIQUE,          -- e.g. 'INC-2026-081'
    title VARCHAR(150) NOT NULL,                        -- e.g. 'Critical Cardiac Emergency · BKC'
    incident_type VARCHAR(40) NOT NULL,                 -- 'MEDICAL', 'FIRE', 'POLICE', 'RESCUE', 'TRAUMA'
    priority_level VARCHAR(20) NOT NULL DEFAULT 'HIGH', -- 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    location_name VARCHAR(150) NOT NULL,                -- e.g. 'Bandra Kurla Complex, G-Block'
    landmark VARCHAR(150),
    caller_contact VARCHAR(30),
    origin_point VARCHAR(100) NOT NULL,                 -- Dispatch starting point
    destination_point VARCHAR(100) NOT NULL,            -- Final medical/rescue facility
    status VARCHAR(25) NOT NULL DEFAULT 'REPORTED',     -- 'REPORTED', 'DISPATCHED', 'RESOLVED', 'CANCELLED'
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority_level);

-- ----------------------------------------------------------------------------
-- 4. ROUTES / CORRIDORS TABLE
-- Pre-calculated or algorithmically computed emergency corridors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_code VARCHAR(30) NOT NULL UNIQUE,             -- e.g. 'RT-WEH-KEM'
    name VARCHAR(150) NOT NULL,                         -- e.g. 'WEH -> Bandra -> Mahim -> KEM Hospital'
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    total_distance_km DECIMAL(5, 2) NOT NULL,           -- e.g. 2.80
    estimated_time_min DECIMAL(5, 2) NOT NULL,          -- Baseline transit time without preemption
    geom_path_id VARCHAR(50),                           -- Maps to SVG/GIS vector path
    typical_congestion VARCHAR(20) DEFAULT 'MODERATE',  -- 'LOW', 'MODERATE', 'HEAVY', 'SEVERE'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. ROUTE_SIGNALS (JUNCTION TABLE)
-- Defines the ordered sequence of traffic signals along each route corridor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    signal_id INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,                    -- 1, 2, 3... order encountered along route
    distance_from_start_km DECIMAL(5, 2) NOT NULL,
    preemption_offset_sec INTEGER DEFAULT 0,            -- Scheduled green-switch advance offset
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (signal_id) REFERENCES traffic_signals(id) ON DELETE CASCADE,
    UNIQUE(route_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_route_signals_route ON route_signals(route_id);

-- ----------------------------------------------------------------------------
-- 6. DISPATCH_MISSIONS TABLE
-- Core operational entity: Links vehicle, incident, and route into an active mission
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispatch_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_code VARCHAR(30) NOT NULL UNIQUE,           -- e.g. 'MIS-MUM-4401'
    incident_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'DISPATCHED',   -- 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'CANCELLED'
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    arrival_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_progress_pct DECIMAL(5, 2) DEFAULT 0.00,    -- 0.0 to 100.0%
    average_speed_kmh DECIMAL(5, 2) DEFAULT 0.00,
    delay_saved_seconds INTEGER DEFAULT 0,              -- Time saved compared to baseline due to preemption
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_missions_status ON dispatch_missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_vehicle ON dispatch_missions(vehicle_id);

-- ----------------------------------------------------------------------------
-- 7. PREEMPTION_LOGS TABLE
-- Audit trail of every automated or manual signal preemption event
-- Essential for university project DBMS demonstration and traffic safety audit
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preemption_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    signal_id INTEGER NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_at TIMESTAMP,
    released_at TIMESTAMP,
    duration_seconds INTEGER,
    trigger_type VARCHAR(30) NOT NULL DEFAULT 'PROXIMITY_AUTO', -- 'PROXIMITY_AUTO', 'MANUAL_DISPATCHER', 'CASCADE_WAVE'
    status VARCHAR(20) NOT NULL DEFAULT 'GRANTED',              -- 'REQUESTED', 'GRANTED', 'RELEASED', 'OVERRIDDEN'
    clearance_speed_kmh INTEGER,
    FOREIGN KEY (mission_id) REFERENCES dispatch_missions(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (signal_id) REFERENCES traffic_signals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_preemption_mission ON preemption_logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_preemption_signal ON preemption_logs(signal_id);

-- ----------------------------------------------------------------------------
-- 8. VEHICLE_TELEMETRY TABLE
-- High-frequency time-series telemetry recorded during emergency runs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    speed_kmh INTEGER NOT NULL,
    progress_pct DECIMAL(5, 2) NOT NULL,
    traffic_condition VARCHAR(30) NOT NULL,             -- 'FREE_FLOW', 'MODERATE', 'HEAVY_CONGESTION', 'APPROACH'
    instruction_text VARCHAR(255),                      -- Current dispatcher voice/nav prompt
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES dispatch_missions(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON vehicle_telemetry(mission_id);

-- ----------------------------------------------------------------------------
-- 9. PERFORMANCE_METRICS (ANALYTICS SUMMARY)
-- Aggregated daily KPIs for response time optimization and preemption efficiency
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date DATE NOT NULL,
    corridor_name VARCHAR(100) NOT NULL,
    total_missions INTEGER NOT NULL DEFAULT 0,
    avg_response_time_min DECIMAL(5, 2) NOT NULL,
    avg_speed_kmh DECIMAL(5, 2) NOT NULL,
    total_delay_saved_min DECIMAL(6, 2) NOT NULL,
    preemption_success_rate_pct DECIMAL(5, 2) NOT NULL DEFAULT 100.0,
    UNIQUE(metric_date, corridor_name)
);
