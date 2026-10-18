CREATE VIEW IF NOT EXISTS vw_active_dispatches AS
SELECT 
    m.id AS mission_id,
    m.mission_code,
    m.status AS mission_status,
    m.current_progress_pct,
    m.average_speed_kmh,
    m.delay_saved_seconds,
    i.id AS incident_id,
    i.incident_code,
    i.title AS incident_title,
    i.incident_type,
    i.priority_level,
    i.location_name AS incident_location,
    v.id AS vehicle_id,
    v.call_sign AS vehicle_name,
    v.unit_label,
    v.vehicle_type,
    v.registration_no,
    v.driver_name,
    v.current_lat AS vehicle_lat,
    v.current_lng AS vehicle_lng,
    v.last_speed_kmh AS current_speed,
    r.id AS route_id,
    r.name AS route_name,
    r.origin,
    r.destination,
    r.total_distance_km,
    r.estimated_time_min AS baseline_time_min,
    m.dispatched_at
FROM dispatch_missions m
INNER JOIN incidents i ON m.incident_id = i.id
INNER JOIN vehicles v ON m.vehicle_id = v.id
INNER JOIN routes r ON m.route_id = r.id
WHERE m.status IN ('DISPATCHED', 'IN_TRANSIT');

CREATE VIEW IF NOT EXISTS vw_signal_realtime_status AS
SELECT 
    s.id AS signal_id,
    s.signal_code,
    s.name AS intersection_name,
    s.corridor_name,
    s.latitude,
    s.longitude,
    s.default_cycle_sec,
    s.current_state,
    s.is_preempted,
    s.override_mode,
    v.call_sign AS holding_vehicle,
    v.vehicle_type AS holding_vehicle_type,
    p.granted_at AS preemption_start_time,
    s.updated_at
FROM traffic_signals s
LEFT JOIN vehicles v ON s.preempted_by_vehicle_id = v.id
LEFT JOIN preemption_logs p ON p.signal_id = s.id AND p.status = 'GRANTED';

CREATE VIEW IF NOT EXISTS vw_fleet_readiness AS
SELECT 
    vehicle_type,
    COUNT(*) AS total_units,
    SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS units_ready,
    SUM(CASE WHEN status = 'EN_ROUTE' THEN 1 ELSE 0 END) AS units_active,
    SUM(CASE WHEN status = 'ON_SCENE' THEN 1 ELSE 0 END) AS units_on_scene,
    SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) AS units_maintenance,
    ROUND(AVG(max_speed_kmh), 1) AS avg_top_speed
FROM vehicles
GROUP BY vehicle_type;

CREATE VIEW IF NOT EXISTS vw_corridor_efficiency AS
SELECT 
    r.name AS corridor_name,
    r.total_distance_km,
    COUNT(m.id) AS total_runs,
    ROUND(AVG(m.average_speed_kmh), 1) AS avg_velocity_kmh,
    ROUND(AVG(m.delay_saved_seconds) / 60.0, 2) AS avg_delay_saved_min,
    ROUND(AVG(r.estimated_time_min - (m.delay_saved_seconds / 60.0)), 2) AS effective_response_time_min,
    ROUND(
        ((AVG(r.estimated_time_min) - AVG(r.estimated_time_min - (m.delay_saved_seconds / 60.0))) 
        / AVG(r.estimated_time_min)) * 100.0, 1
    ) AS response_time_improvement_pct
FROM routes r
LEFT JOIN dispatch_missions m ON r.id = m.route_id
GROUP BY r.id, r.name, r.total_distance_km;


SELECT * FROM vw_active_dispatches;

-- ----------------------------------------------------------------------------
-- API Query 2: GET /api/v1/signals
-- Fetches all traffic signals with live preemption indicators
-- ----------------------------------------------------------------------------
SELECT * FROM vw_signal_realtime_status;

-- ----------------------------------------------------------------------------
-- API Query 3: POST /api/v1/preemption/trigger
-- Triggers green-wave preemption when vehicle enters signal trigger radius
-- Step A: Log preemption grant
-- Step B: Update signal hardware state to PREEMPTED
-- ----------------------------------------------------------------------------
-- Example params: :mission_id = 1, :vehicle_id = 1, :signal_id = 2
INSERT INTO preemption_logs (mission_id, vehicle_id, signal_id, requested_at, granted_at, trigger_type, status, clearance_speed_kmh)
VALUES (1, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PROXIMITY_AUTO', 'GRANTED', 74);

UPDATE traffic_signals 
SET current_state = 'PREEMPTED', 
    is_preempted = 1, 
    preempted_by_vehicle_id = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 2;

-- ----------------------------------------------------------------------------
-- API Query 4: POST /api/v1/preemption/release
-- Restores traffic signal to automated cycle after vehicle clears the junction
-- ----------------------------------------------------------------------------
-- Example params: :signal_id = 2, :vehicle_id = 1
UPDATE preemption_logs
SET status = 'RELEASED',
    released_at = CURRENT_TIMESTAMP,
    duration_seconds = 135
WHERE signal_id = 2 AND vehicle_id = 1 AND status = 'GRANTED';

UPDATE traffic_signals
SET current_state = 'GREEN',
    is_preempted = 0,
    preempted_by_vehicle_id = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 2;

-- ----------------------------------------------------------------------------
-- API Query 5: POST /api/v1/dispatches/new
-- Creates an incident and dispatches the nearest available vehicle
-- ----------------------------------------------------------------------------
-- Step A: Find available unit by required type
SELECT id, call_sign, base_station 
FROM vehicles 
WHERE status = 'AVAILABLE' AND vehicle_type = 'Medical Trauma Unit' 
LIMIT 1;

-- Step B: Insert Incident
-- (Uses parameters: code, title, type, priority, location, origin, destination)
-- INSERT INTO incidents (...) VALUES (...);

-- Step C: Create Mission and Mark Vehicle Busy
-- INSERT INTO dispatch_missions (mission_code, incident_id, vehicle_id, route_id, status) ...
-- UPDATE vehicles SET status = 'EN_ROUTE' WHERE id = :vehicle_id;

-- ----------------------------------------------------------------------------
-- API Query 6: POST /api/v1/telemetry/record
-- Logs vehicle breadcrumb telemetry during transit
-- ----------------------------------------------------------------------------
INSERT INTO vehicle_telemetry (mission_id, vehicle_id, speed_kmh, progress_pct, traffic_condition, instruction_text)
VALUES (1, 1, 75, 70.50, 'MODERATE', 'Approaching Tilak Flyover · Green wave priority held');

UPDATE vehicles
SET current_lat = 19.0195,
    current_lng = 72.8465,
    last_speed_kmh = 75,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

UPDATE dispatch_missions
SET current_progress_pct = 70.50,
    average_speed_kmh = 74.50
WHERE id = 1;


-- ============================================================================
-- SECTION 3: ANALYTICAL & PERFORMANCE QUERIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Analytical Query 1: "How do you calculate response time savings across corridors?"
-- Demonstrates multi-table JOIN, aggregate functions, and mathematical derivation
-- ----------------------------------------------------------------------------
SELECT 
    r.route_code,
    r.name AS corridor_name,
    COUNT(m.id) AS completed_missions,
    ROUND(AVG(r.estimated_time_min), 2) AS standard_traffic_eta_min,
    ROUND(AVG(r.estimated_time_min) - (AVG(m.delay_saved_seconds) / 60.0), 2) AS preemption_actual_eta_min,
    ROUND(AVG(m.delay_saved_seconds) / 60.0, 2) AS time_saved_min,
    ROUND((AVG(m.delay_saved_seconds) / (AVG(r.estimated_time_min) * 60.0)) * 100.0, 1) AS efficiency_gain_pct
FROM routes r
JOIN dispatch_missions m ON r.id = m.route_id
WHERE m.status IN ('COMPLETED', 'IN_TRANSIT')
GROUP BY r.id, r.route_code, r.name;

-- ----------------------------------------------------------------------------
-- Analytical Query 2: "Which traffic signals experience the longest preemption hold?"
-- Detects potential bottlenecks in non-emergency cross-traffic flow
-- ----------------------------------------------------------------------------
SELECT 
    s.signal_code,
    s.name AS intersection_name,
    s.corridor_name,
    COUNT(p.id) AS total_preemptions,
    COALESCE(SUM(p.duration_seconds), 0) AS total_hold_seconds,
    ROUND(COALESCE(AVG(p.duration_seconds), 0), 1) AS avg_hold_seconds,
    MAX(p.duration_seconds) AS max_single_hold_seconds
FROM traffic_signals s
LEFT JOIN preemption_logs p ON s.id = p.signal_id
GROUP BY s.id, s.signal_code, s.name, s.corridor_name
ORDER BY total_hold_seconds DESC;

-- ----------------------------------------------------------------------------
-- Analytical Query 3: "Find all signals encountered on Route 1 in exact order with coordinates"
-- Demonstrates Junction Table query with foreign key navigation
-- ----------------------------------------------------------------------------
SELECT 
    rs.sequence_order,
    s.signal_code,
    s.name AS intersection_name,
    s.latitude,
    s.longitude,
    rs.distance_from_start_km,
    rs.preemption_offset_sec,
    s.current_state,
    s.is_preempted
FROM route_signals rs
JOIN traffic_signals s ON rs.signal_id = s.id
WHERE rs.route_id = 1
ORDER BY rs.sequence_order ASC;
