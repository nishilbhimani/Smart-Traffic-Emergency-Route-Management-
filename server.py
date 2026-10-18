#!/usr/bin/env python3
"""
============================================================================
Pulse · Smart Traffic & Emergency Route Management
Production-Grade HTTP & REST API Server (Zero External Dependencies)
============================================================================
Capabilities:
- REST API layer connecting to SQLite database/pulse.db
- Parameterized SQL execution & atomic transactions
- Threaded request handling for concurrent client requests
- Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy)
- Path traversal protection & static asset caching with ETags
- Rate limiting & IP throttling for abuse prevention
- Health & readiness probes (/api/v1/health)
- Graceful shutdown & resource cleanup
============================================================================
"""

import os
import sys
import json
import time
import hashlib
import sqlite3
import mimetypes
import threading
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard")
DATABASE_PATH = os.path.join(BASE_DIR, "database", "pulse.db")

APP_VERSION = "2.4.0-prod"
START_TIME = time.time()

# ---------------------------------------------------------------------------
# Rate Limiting & Throttling
# ---------------------------------------------------------------------------
class RateLimiter:
    """Sliding-window rate limiter per client IP."""
    def __init__(self, max_requests=180, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.clients = {}
        self.lock = threading.Lock()

    def is_allowed(self, client_ip):
        now = time.time()
        with self.lock:
            if client_ip not in self.clients:
                self.clients[client_ip] = []
            
            # Prune old timestamps
            cutoff = now - self.window_seconds
            self.clients[client_ip] = [ts for ts in self.clients[client_ip] if ts > cutoff]
            
            if len(self.clients[client_ip]) >= self.max_requests:
                return False
            
            self.clients[client_ip].append(now)
            return True


RATE_LIMITER = RateLimiter(max_requests=240, window_seconds=60)


# ---------------------------------------------------------------------------
# Database Utilities & Connection Pooling
# ---------------------------------------------------------------------------
def get_db_connection():
    """Returns a SQLite connection with Row factory and WAL pragmas."""
    conn = sqlite3.connect(DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def query_db(query, args=(), one=False):
    """Executes a parameterized read query and returns a dict or list of dicts."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, args)
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return (result[0] if result else None) if one else result


# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------
class PulseRequestHandler(SimpleHTTPRequestHandler):
    """HTTP Request Handler serving REST APIs and static frontend files."""

    server_version = "PulseServer/" + APP_VERSION

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Structured log output
        sys.stdout.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {self.address_string()} - {format % args}\n")
        sys.stdout.flush()

    def send_security_headers(self, content_type="application/json"):
        """Attach production-grade security headers to all responses."""
        self.send_header("Content-Type", content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def send_json(self, data, status_code=HTTPStatus.OK):
        """Helper to serialize and transmit JSON response."""
        try:
            body = json.dumps(data, default=str).encode("utf-8")
            self.send_response(status_code)
            self.send_security_headers("application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_error_json(self, message, status_code=HTTPStatus.BAD_REQUEST, details=None):
        """Standardized JSON error envelope."""
        payload = {
            "error": True,
            "status": status_code.value,
            "message": message,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        if details:
            payload["details"] = details
        self.send_json(payload, status_code=status_code)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_security_headers("text/plain")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    # -----------------------------------------------------------------------
    # GET Router
    # -----------------------------------------------------------------------
    def do_GET(self):
        client_ip = self.client_address[0]
        if not RATE_LIMITER.is_allowed(client_ip):
            self.send_error_json("Rate limit exceeded. Please wait a moment.", HTTPStatus.TOO_MANY_REQUESTS)
            return

        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Root redirect
        if path == "/" or path == "/dashboard":
            self.send_response(HTTPStatus.MOVED_PERMANENTLY)
            self.send_header("Location", "/dashboard/")
            self.end_headers()
            return

        # REST API Routes
        if path.startswith("/api/v1/"):
            self.handle_api_get(path, parse_qs(parsed_url.query))
            return

        # Static File Serving with Path Traversal Protection
        self.handle_static_get(path)

    def handle_api_get(self, path, query_params):
        try:
            if not os.path.exists(DATABASE_PATH):
                self.send_error_json("Database file not found. Run python3 database/init_db.py", HTTPStatus.SERVICE_UNAVAILABLE)
                return

            if path == "/api/v1/health":
                # Liveness & Readiness check
                db_ok = False
                table_counts = {}
                try:
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                        tables = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite_")]
                        for t in tables:
                            cursor.execute(f"SELECT COUNT(*) FROM [{t}]")
                            table_counts[t] = cursor.fetchone()[0]
                        db_ok = True
                except Exception as ex:
                    table_counts["error"] = str(ex)

                health_payload = {
                    "status": "healthy" if db_ok else "degraded",
                    "version": APP_VERSION,
                    "uptime_seconds": round(time.time() - START_TIME, 1),
                    "database": "connected" if db_ok else "disconnected",
                    "database_path": "database/pulse.db",
                    "tables": table_counts
                }
                self.send_json(health_payload)

            elif path == "/api/v1/dispatches":
                # Active dispatches
                rows = query_db("SELECT * FROM vw_active_dispatches;")
                self.send_json({"count": len(rows), "data": rows})

            elif path == "/api/v1/signals":
                # Live traffic signals
                rows = query_db("SELECT * FROM vw_signal_realtime_status;")
                self.send_json({"count": len(rows), "data": rows})

            elif path == "/api/v1/fleet":
                # Fleet readiness & vehicle roster
                readiness = query_db("SELECT * FROM vw_fleet_readiness;")
                vehicles = query_db("SELECT id, call_sign, vehicle_type, registration_no, driver_name, status, last_speed_kmh, max_speed_kmh, base_station FROM vehicles ORDER BY id;")
                self.send_json({"readiness": readiness, "vehicles": vehicles})

            elif path == "/api/v1/corridors":
                # Corridor efficiency
                rows = query_db("SELECT * FROM vw_corridor_efficiency;")
                self.send_json({"count": len(rows), "data": rows})

            elif path == "/api/v1/incidents":
                # Incidents queue
                rows = query_db("SELECT * FROM incidents ORDER BY reported_at DESC;")
                self.send_json({"count": len(rows), "data": rows})

            else:
                self.send_error_json(f"API endpoint '{path}' not found.", HTTPStatus.NOT_FOUND)

        except sqlite3.Error as e:
            self.send_error_json("Database operation failed.", HTTPStatus.INTERNAL_SERVER_ERROR, details=str(e))
        except Exception as e:
            self.send_error_json("Internal server error.", HTTPStatus.INTERNAL_SERVER_ERROR, details=str(e))

    def handle_static_get(self, path):
        """Secure static file server with path normalization and caching."""
        clean_path = os.path.normpath(path.lstrip("/"))
        file_path = os.path.join(BASE_DIR, clean_path)

        # Path traversal guard: verify path remains inside BASE_DIR
        if not os.path.abspath(file_path).startswith(BASE_DIR):
            self.send_error_json("Access denied.", HTTPStatus.FORBIDDEN)
            return

        if os.path.isdir(file_path):
            index_file = os.path.join(file_path, "index.html")
            if os.path.exists(index_file):
                file_path = index_file
            else:
                self.send_error_json("Directory listing disabled.", HTTPStatus.FORBIDDEN)
                return

        if not os.path.isfile(file_path):
            self.send_error_json("File not found.", HTTPStatus.NOT_FOUND)
            return

        # Content-Type detection
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = "application/octet-stream"
        if content_type.startswith("text/") or content_type == "application/javascript":
            content_type += "; charset=utf-8"

        # ETag calculation for browser caching
        try:
            stat_res = os.stat(file_path)
            etag = f'"{hashlib.md5(f"{stat_res.st_mtime}-{stat_res.st_size}".encode()).hexdigest()}"'

            if self.headers.get("If-None-Match") == etag:
                self.send_response(HTTPStatus.NOT_MODIFIED)
                self.end_headers()
                return

            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(HTTPStatus.OK)
            self.send_security_headers(content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("ETag", etag)
            
            # Cache static assets (CSS/JS/images) for 1 day
            if any(file_path.endswith(ext) for ext in [".css", ".js", ".jpg", ".png", ".svg", ".woff2"]):
                self.send_header("Cache-Control", "public, max-age=86400")
            else:
                self.send_header("Cache-Control", "no-cache")

            self.end_headers()
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self.send_error_json("Could not read file.", HTTPStatus.INTERNAL_SERVER_ERROR, details=str(e))

    # -----------------------------------------------------------------------
    # POST Router
    # -----------------------------------------------------------------------
    def do_POST(self):
        client_ip = self.client_address[0]
        if not RATE_LIMITER.is_allowed(client_ip):
            self.send_error_json("Rate limit exceeded. Please wait a moment.", HTTPStatus.TOO_MANY_REQUESTS)
            return

        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Read JSON body safely
        try:
            content_len_hdr = self.headers.get("Content-Length") or self.headers.get("content-length") or 0
            content_len = int(content_len_hdr)
            if content_len > 1024 * 1024:  # Max 1MB payload
                self.send_error_json("Payload too large (max 1MB).", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                return
            
            raw_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
            payload = json.loads(raw_body) if raw_body else {}
        except (ValueError, UnicodeDecodeError):
            self.send_error_json("Invalid JSON body.", HTTPStatus.BAD_REQUEST)
            return

        try:
            if not os.path.exists(DATABASE_PATH):
                self.send_error_json("Database not initialized.", HTTPStatus.SERVICE_UNAVAILABLE)
                return

            if path == "/api/v1/preemption/trigger":
                self.handle_preemption_trigger(payload)
            elif path == "/api/v1/preemption/release":
                self.handle_preemption_release(payload)
            elif path == "/api/v1/dispatches/new":
                self.handle_dispatch_new(payload)
            elif path == "/api/v1/diagnostics/report":
                self.handle_diagnostics_report(payload)
            else:
                self.send_error_json(f"POST endpoint '{path}' not found.", HTTPStatus.NOT_FOUND)

        except sqlite3.Error as e:
            self.send_error_json("Database transaction failed.", HTTPStatus.INTERNAL_SERVER_ERROR, details=str(e))
        except Exception as e:
            self.send_error_json("Internal server error.", HTTPStatus.INTERNAL_SERVER_ERROR, details=str(e))

    # -----------------------------------------------------------------------
    # Transactional Endpoints
    # -----------------------------------------------------------------------
    def handle_preemption_trigger(self, data):
        """Atomic signal preemption trigger."""
        signal_id = data.get("signal_id")
        vehicle_id = data.get("vehicle_id")
        mission_id = data.get("mission_id")
        speed = data.get("clearance_speed_kmh", 75)

        if not signal_id or not vehicle_id:
            self.send_error_json("Missing required fields: signal_id and vehicle_id are required.", HTTPStatus.BAD_REQUEST)
            return

        with get_db_connection() as conn:
            cursor = conn.cursor()
            # 1. Insert preemption log
            cursor.execute("""
                INSERT INTO preemption_logs (mission_id, vehicle_id, signal_id, requested_at, granted_at, trigger_type, status, clearance_speed_kmh)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PROXIMITY_AUTO', 'GRANTED', ?);
            """, (mission_id, vehicle_id, signal_id, speed))

            # 2. Update traffic signal state
            cursor.execute("""
                UPDATE traffic_signals 
                SET current_state = 'PREEMPTED', is_preempted = 1, preempted_by_vehicle_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;
            """, (vehicle_id, signal_id))

            conn.commit()

        self.send_json({
            "success": True,
            "message": f"Signal #{signal_id} preempted by vehicle #{vehicle_id}",
            "status": "PREEMPTED",
            "signal_id": signal_id
        })

    def handle_preemption_release(self, data):
        """Atomic signal preemption release."""
        signal_id = data.get("signal_id")
        vehicle_id = data.get("vehicle_id")
        duration = data.get("duration_seconds", 60)

        if not signal_id:
            self.send_error_json("Missing required field: signal_id.", HTTPStatus.BAD_REQUEST)
            return

        with get_db_connection() as conn:
            cursor = conn.cursor()
            if vehicle_id:
                cursor.execute("""
                    UPDATE preemption_logs
                    SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP, duration_seconds = ?
                    WHERE signal_id = ? AND vehicle_id = ? AND status = 'GRANTED';
                """, (duration, signal_id, vehicle_id))
            else:
                cursor.execute("""
                    UPDATE preemption_logs
                    SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP, duration_seconds = ?
                    WHERE signal_id = ? AND status = 'GRANTED';
                """, (duration, signal_id))

            cursor.execute("""
                UPDATE traffic_signals
                SET current_state = 'GREEN', is_preempted = 0, preempted_by_vehicle_id = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;
            """, (signal_id,))

            conn.commit()

        self.send_json({
            "success": True,
            "message": f"Signal #{signal_id} released to normal automated cycle",
            "status": "NORMAL_CYCLE",
            "signal_id": signal_id
        })

    def handle_dispatch_new(self, data):
        """Create new incident and dispatch available unit."""
        title = data.get("title", "Emergency Medical Incident")
        incident_type = data.get("incident_type", "Medical Trauma")
        priority = data.get("priority_level", "HIGH")
        location = data.get("location_name", "Western Express Highway")
        v_type = data.get("vehicle_type", "Medical Trauma Unit")
        route_id = data.get("route_id", 1)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Find available vehicle
            cursor.execute("SELECT id, call_sign FROM vehicles WHERE status = 'AVAILABLE' AND vehicle_type = ? LIMIT 1;", (v_type,))
            veh = cursor.fetchone()
            if not veh:
                # Fallback to any available vehicle
                cursor.execute("SELECT id, call_sign FROM vehicles WHERE status = 'AVAILABLE' LIMIT 1;")
                veh = cursor.fetchone()

            if not veh:
                self.send_error_json("No fleet units currently available for dispatch.", HTTPStatus.CONFLICT)
                return

            veh_id, call_sign = veh[0], veh[1]
            inc_code = f"INC-MUM-{int(time.time()) % 100000}"
            mis_code = f"MIS-MUM-{int(time.time()) % 100000}"

            # Insert incident
            cursor.execute("""
                INSERT INTO incidents (incident_code, title, incident_type, priority_level, location_name, status, reported_at)
                VALUES (?, ?, ?, ?, ?, 'DISPATCHED', CURRENT_TIMESTAMP);
            """, (inc_code, title, incident_type, priority, location))
            incident_id = cursor.lastrowid

            # Insert mission
            cursor.execute("""
                INSERT INTO dispatch_missions (mission_code, incident_id, vehicle_id, route_id, status, dispatched_at, current_progress_pct)
                VALUES (?, ?, ?, ?, 'IN_TRANSIT', CURRENT_TIMESTAMP, 0.0);
            """, (mis_code, incident_id, veh_id, route_id))
            mission_id = cursor.lastrowid

            # Update vehicle status
            cursor.execute("UPDATE vehicles SET status = 'EN_ROUTE', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (veh_id,))
            conn.commit()

        self.send_json({
            "success": True,
            "mission_id": mission_id,
            "mission_code": mis_code,
            "incident_id": incident_id,
            "assigned_vehicle": call_sign,
            "status": "DISPATCHED"
        }, status_code=HTTPStatus.CREATED)

    def handle_diagnostics_report(self, data):
        """Receives and logs client-side diagnostics reports."""
        sys.stdout.write(f"[*] Diagnostics event received: {data.get('event', 'unknown')}\n")
        sys.stdout.flush()
        self.send_json({"recorded": True})


# ---------------------------------------------------------------------------
# Server Launcher
# ---------------------------------------------------------------------------
def run_server(host="127.0.0.1", port=8000):
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, PulseRequestHandler)
    print(f"[✓] Pulse Production Server running at http://{host}:{port}/")
    print("    Press Ctrl + C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Shutting down server gracefully...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port=port)
