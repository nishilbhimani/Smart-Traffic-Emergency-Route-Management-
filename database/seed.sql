-- ============================================================================
-- Pulse · Emergency Transit & Preemption System
-- Core Relational DBMS & Operating Systems Engine
-- Seed Dataset (DML)
-- Realistic Mumbai Metropolitan Emergency Transit Data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED VEHICLES
-- ----------------------------------------------------------------------------
INSERT INTO vehicles (id, call_sign, unit_label, vehicle_type, registration_no, driver_name, crew_member, status, base_station, max_speed_kmh, equipment_summary, current_lat, current_lng, last_speed_kmh)
VALUES
(1, '108 Ambulance A-12', 'Ambulance A-12', 'Medical Trauma Unit', 'MH-01-EQ-1082', 'Ramesh Shinde', 'EMT Amit Kadam', 'EN_ROUTE', 'Santacruz Trauma Center (WEH)', 120, 'Life Support Trauma Bay · Defibrillator · Ventilator Unit · Suction Pump', 19.0620, 72.8460, 78),
(2, 'Police Interceptor P-08', 'Police P-08', 'High-Speed Coastal Escort', 'MH-01-CP-0808', 'Sub-Insp. V. Patil', 'Constable M. Kulkarni', 'EN_ROUTE', 'Bandra Traffic Division HQ', 160, 'All-Wheel Drive · Tactical Radar · Emergency Priority Beacon · PA Transceiver', 19.0350, 72.8180, 82),
(3, 'Mumbai Fire Brigade F-03', 'Fire F-03', 'Heavy Commercial Response', 'MH-01-FB-5003', 'Suresh Pawar', 'Leading Fireman R. More', 'EN_ROUTE', 'Kurla Fire Substation', 100, '5000L Foam Cannon · High-Pressure Water Pump · Hydraulic Cutter · 30m Aerial Ladder', 19.0200, 72.8550, 68),
(4, '108 Bike Medic M-02', 'Bike Medic M-02', 'First Responder Unit', 'MH-02-BM-1080', 'Paramedic Nitin Sawant', 'Dr. Reena Deshmukh (Tele-Consult)', 'AVAILABLE', 'Bandra West Rapid Response Station', 110, 'Rapid First Aid Trauma Kit · AED Automated Defibrillator · Portable Oxygen Cylinder', 19.0550, 72.8300, 0),
(5, '108 Ambulance A-07', 'Ambulance A-07', 'Cardiac Support Transfer', 'MH-01-EQ-1087', 'Sunil Jadhav', 'EMT Priya Nair', 'AVAILABLE', 'Lilavati Hospital Transit Bay', 120, 'Advanced Cardiac Monitor · 12-Lead ECG · Infusion Pumps · Trauma Stretcher', 19.0510, 72.8290, 0),
(6, 'Police Interceptor P-14', 'Police P-14', 'Tactical Port Escort', 'MH-01-CP-1414', 'Inspector A. R. Shinde', 'Sub-Insp. K. Rao', 'AVAILABLE', 'Colaba Police Headquarters', 160, 'VIP Convoy Escort Rig · Highway Interceptor Rig · GPS Geo-Fencing Beacon', 18.9220, 72.8340, 0);

-- ----------------------------------------------------------------------------
-- 2. SEED TRAFFIC SIGNALS (6 Key Mumbai Intersections)
-- ----------------------------------------------------------------------------
INSERT INTO traffic_signals (id, signal_code, name, corridor_name, latitude, longitude, default_cycle_sec, current_state, is_preempted, preempted_by_vehicle_id, override_mode, proximity_threshold_meters)
VALUES
(1, 'SIG-MUM-01', 'Bandra Kalanagar Signal #1', 'Western Express Highway Corridor', 19.059600, 72.853000, 90, 'PREEMPTED', 1, 1, 'AUTO', 160),
(2, 'SIG-MUM-02', 'Mahim Causeway Signal #2', 'Mahim Arterial Corridor', 19.041200, 72.841500, 80, 'PREEMPTED', 1, 1, 'AUTO', 150),
(3, 'SIG-MUM-03', 'Dadar TT Circle Signal #3', 'Central Transit Corridor', 19.017800, 72.847800, 90, 'GREEN', 0, NULL, 'AUTO', 175),
(4, 'SIG-MUM-04', 'Worli Sea Face Signal #4', 'Coastal Sea Link Corridor', 19.008400, 72.815200, 60, 'PREEMPTED', 1, 2, 'AUTO', 200),
(5, 'SIG-MUM-05', 'Haji Ali Signal #5', 'Coastal Arterial Crossing', 18.977200, 72.810500, 75, 'RED', 0, NULL, 'AUTO', 150),
(6, 'SIG-MUM-06', 'Byculla Fire Route Crossing #6', 'Central-Eastern Transit Interconnect', 18.975000, 72.833500, 85, 'PREEMPTED', 1, 3, 'AUTO', 180);

-- ----------------------------------------------------------------------------
-- 3. SEED INCIDENTS
-- ----------------------------------------------------------------------------
INSERT INTO incidents (id, incident_code, title, incident_type, priority_level, location_name, landmark, caller_contact, origin_point, destination_point, status, reported_at, notes)
VALUES
(1, 'INC-MUM-2026-001', 'Critical Cardiac Emergency · BKC', 'MEDICAL', 'CRITICAL', 'G-Block, Bandra Kurla Complex', 'Near Trade Centre Towers', '+91 98200 11223', 'Santacruz / Airport WEH', 'KEM Hospital (Parel)', 'DISPATCHED', datetime('now', '-25 minutes'), '58-year-old male presenting acute myocardial infarction symptoms. Urgent catheterization lab prep required.'),
(2, 'INC-MUM-2026-002', 'Sea Link Express Escort · Priority Convoy', 'POLICE', 'HIGH', 'Bandra Toll Plaza, Sea Link Approach', 'Bandra Reclamation Entry', '+91 98200 44556', 'Bandra Reclamation', 'Nariman Point / Mantralaya', 'DISPATCHED', datetime('now', '-18 minutes'), 'VIP State Dignitary Escort to Mantralaya Secretariat. High-speed coastal green wave requested.'),
(3, 'INC-MUM-2026-003', 'Commercial Fire Alert · Mazagaon Industrial Basin', 'FIRE', 'CRITICAL', 'Dockyard Road Warehousing Zone', 'Near Mazagaon Docks Gate 4', '+91 98200 77889', 'Kurla Fire Substation', 'Mazagaon Docks', 'DISPATCHED', datetime('now', '-12 minutes'), 'Chemical warehouse Level-2 fire reported. Dense smoke envelope. Foam tender F-03 dispatched with dual water tenders.'),
(4, 'INC-MUM-2026-004', 'First Responder Trauma Alert · Juhu Beach', 'TRAUMA', 'HIGH', 'Juhu Tara Road Junction', 'Opposite Juhu Beach Promenade', '+91 98200 99001', 'Bandra West Substation', 'Suburban Municipal Trauma Center', 'REPORTED', datetime('now', '-5 minutes'), 'Pedestrian traffic incident. Rapid bike medic dispatched for immediate bleed control and stabilization.'),
(5, 'INC-MUM-2026-005', 'Multi-Vehicle Collision · WEH Kalanagar Flyover', 'ACCIDENT', 'HIGH', 'Western Express Highway Southbound', 'Kalanagar Flyover Crest', '+91 98200 33445', 'Bandra Traffic Police', 'Sion Hospital Trauma Center', 'RESOLVED', datetime('now', '-3 hours'), 'Three passenger vehicles collided during morning peak rush. Preemption cleared corridor in 6.4 minutes. All cleared.');

-- ----------------------------------------------------------------------------
-- 4. SEED ROUTES / CORRIDORS
-- ----------------------------------------------------------------------------
INSERT INTO routes (id, route_code, name, origin, destination, total_distance_km, estimated_time_min, geom_path_id, typical_congestion)
VALUES
(1, 'RT-WEH-KEM', 'WEH -> Bandra Kalanagar -> Mahim Causeway -> KEM Hospital', 'Santacruz / Airport WEH', 'KEM Hospital (Parel)', 2.80, 14.50, 'geom_weh_parel', 'HEAVY'),
(2, 'RT-SEALINK-NARIMAN', 'Sea Link -> Worli Sea Face -> Haji Ali -> Marine Drive', 'Bandra Reclamation', 'Nariman Point / Mantralaya', 4.60, 19.00, 'geom_sealink_nariman', 'MODERATE'),
(3, 'RT-SION-MAZAGAON', 'Kurla -> Sion -> Wadala -> Eastern Freeway -> Mazagaon', 'Kurla Fire Substation', 'Mazagaon Docks', 3.20, 16.00, 'geom_eastern_mazagaon', 'HEAVY'),
(4, 'RT-SV-JUHU', 'Bandra West -> S.V. Road -> Juhu Beach', 'Bandra West Substation', 'Juhu Beach Promenade', 2.10, 11.00, 'geom_sv_juhu', 'MODERATE');

-- ----------------------------------------------------------------------------
-- 5. SEED ROUTE_SIGNALS (Sequence of signals per corridor)
-- ----------------------------------------------------------------------------
INSERT INTO route_signals (id, route_id, signal_id, sequence_order, distance_from_start_km, preemption_offset_sec)
VALUES
-- Route 1 (WEH to KEM Hospital): Signals 1, 2, 3
(1, 1, 1, 1, 0.85, 20), -- Bandra Kalanagar
(2, 1, 2, 2, 1.65, 30), -- Mahim Causeway
(3, 1, 3, 3, 2.30, 25), -- Dadar TT Circle

-- Route 2 (Sea Link to Nariman Point): Signals 4, 5
(4, 2, 4, 1, 1.40, 25), -- Worli Sea Face Exit
(5, 2, 5, 2, 2.95, 35), -- Haji Ali Junction

-- Route 3 (Kurla to Mazagaon): Signal 6
(6, 3, 6, 1, 1.80, 25); -- Byculla Fire Route Crossing

-- ----------------------------------------------------------------------------
-- 6. SEED DISPATCH MISSIONS
-- ----------------------------------------------------------------------------
INSERT INTO dispatch_missions (id, mission_code, incident_id, vehicle_id, route_id, status, dispatched_at, arrival_at, completed_at, current_progress_pct, average_speed_kmh, delay_saved_seconds)
VALUES
(1, 'MIS-MUM-4401', 1, 1, 1, 'IN_TRANSIT', datetime('now', '-8 minutes'), NULL, NULL, 64.50, 74.20, 310),
(2, 'MIS-MUM-4402', 2, 2, 2, 'IN_TRANSIT', datetime('now', '-6 minutes'), NULL, NULL, 48.00, 78.50, 420),
(3, 'MIS-MUM-4403', 3, 3, 3, 'IN_TRANSIT', datetime('now', '-4 minutes'), NULL, NULL, 31.00, 68.00, 240),
(4, 'MIS-MUM-4400', 5, 5, 1, 'COMPLETED', datetime('now', '-3 hours'), datetime('now', '-2 hours', '-52 minutes'), datetime('now', '-2 hours', '-30 minutes'), 100.00, 62.40, 380);

-- ----------------------------------------------------------------------------
-- 7. SEED PREEMPTION LOGS (Signals locked green for emergency vehicles)
-- ----------------------------------------------------------------------------
INSERT INTO preemption_logs (id, mission_id, vehicle_id, signal_id, requested_at, granted_at, released_at, duration_seconds, trigger_type, status, clearance_speed_kmh)
VALUES
(1, 1, 1, 1, datetime('now', '-7 minutes'), datetime('now', '-7 minutes'), datetime('now', '-5 minutes'), 120, 'PROXIMITY_AUTO', 'RELEASED', 76),
(2, 1, 1, 2, datetime('now', '-4 minutes'), datetime('now', '-4 minutes'), NULL, NULL, 'PROXIMITY_AUTO', 'GRANTED', 74),
(3, 2, 2, 4, datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), NULL, NULL, 'CASCADE_WAVE', 'GRANTED', 82),
(4, 3, 3, 6, datetime('now', '-2 minutes'), datetime('now', '-2 minutes'), NULL, NULL, 'PROXIMITY_AUTO', 'GRANTED', 68),
(5, 4, 5, 1, datetime('now', '-3 hours'), datetime('now', '-3 hours'), datetime('now', '-2 hours', '-58 minutes'), 120, 'PROXIMITY_AUTO', 'RELEASED', 65),
(6, 4, 5, 2, datetime('now', '-2 hours', '-58 minutes'), datetime('now', '-2 hours', '-58 minutes'), datetime('now', '-2 hours', '-55 minutes'), 180, 'PROXIMITY_AUTO', 'RELEASED', 58),
(7, 4, 5, 3, datetime('now', '-2 hours', '-55 minutes'), datetime('now', '-2 hours', '-55 minutes'), datetime('now', '-2 hours', '-52 minutes'), 180, 'PROXIMITY_AUTO', 'RELEASED', 62);

-- ----------------------------------------------------------------------------
-- 8. SEED VEHICLE TELEMETRY (Sample points along trajectory)
-- ----------------------------------------------------------------------------
INSERT INTO vehicle_telemetry (mission_id, vehicle_id, speed_kmh, progress_pct, traffic_condition, instruction_text, recorded_at)
VALUES
(1, 1, 76, 18.00, 'FREE_FLOW', 'Western Express Highway: High-speed corridor locked · Signals held green · Zero traffic delay', datetime('now', '-6 minutes')),
(1, 1, 24, 38.00, 'HEAVY_CONGESTION', 'Mahim Causeway Bottleneck: Navigating severe bumper-to-bumper congestion · Dual siren clearing crawl lane', datetime('now', '-4 minutes')),
(1, 1, 72, 62.00, 'MODERATE', 'Dadar TT Corridor: Preemption green wave clearing cross-traffic · Accelerating across Tilak Flyover', datetime('now', '-1 minute')),
(2, 2, 79, 25.00, 'FREE_FLOW', 'Bandra-Worli Sea Link: High-speed coastal bridge · Toll gates bypassed · Priority escort locked · Signals held green', datetime('now', '-4 minutes')),
(2, 2, 26, 45.00, 'HEAVY_CONGESTION', 'Haji Ali Junction: Navigating severe coastal gridlock · Tactical siren wave clearing intersection', datetime('now', '-2 minutes')),
(3, 3, 68, 29.00, 'FREE_FLOW', 'Eastern Freeway Elevated Corridor: Clear run south · Heavy commercial vehicle priority locked', datetime('now', '-2 minutes'));

-- ----------------------------------------------------------------------------
-- 9. SEED PERFORMANCE METRICS (Historical aggregated analytics)
-- ----------------------------------------------------------------------------
INSERT INTO performance_metrics (metric_date, corridor_name, total_missions, avg_response_time_min, avg_speed_kmh, total_delay_saved_min, preemption_success_rate_pct)
VALUES
(date('now', '-3 days'), 'Western Express Highway Corridor', 14, 6.20, 68.40, 84.50, 97.20),
(date('now', '-3 days'), 'Coastal Sea Link Corridor', 8, 5.10, 78.90, 52.00, 100.00),
(date('now', '-2 days'), 'Western Express Highway Corridor', 16, 5.80, 71.20, 98.00, 96.50),
(date('now', '-2 days'), 'Eastern Freeway Corridor', 11, 7.40, 64.00, 61.50, 95.00),
(date('now', '-1 days'), 'Western Express Highway Corridor', 18, 5.40, 73.50, 112.00, 98.10),
(date('now', '-1 days'), 'Coastal Sea Link Corridor', 9, 4.90, 81.20, 58.50, 100.00),
(date('now'), 'All Metropolitan Peninsula Corridors', 38, 5.75, 71.80, 235.00, 97.80);
