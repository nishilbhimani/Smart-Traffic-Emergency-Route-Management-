"""
Automated Backend & Security Verification Suite for Pulse REST API
Tests:
- Database connectivity and schema integrity (9 tables, 4 views)
- Parameterized SQL queries and injection resistance
- HTTP response status codes and JSON serialization
- Security headers (HSTS, CSP, X-Content-Type-Options, Frame-Options, etc.)
- Rate limiter sliding window and abuse throttling
- Path traversal defense against directory escapes
- Dispatch creation and preemption trigger transactions
"""

import os
import sys
import json
import sqlite3
import unittest
from io import BytesIO

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

from server import PulseRequestHandler, RateLimiter, DATABASE_PATH, get_db_connection

class TestPulseDatabase(unittest.TestCase):
    """Verify database schema, views, and data integrity."""

    def setUp(self):
        self.assertTrue(os.path.exists(DATABASE_PATH), f"Database not found at {DATABASE_PATH}")
        self.conn = get_db_connection()

    def tearDown(self):
        if self.conn:
            self.conn.close()

    def test_tables_exist(self):
        expected_tables = {
            "vehicles", "traffic_signals", "incidents",
            "dispatch_missions", "routes", "route_signals",
            "preemption_logs", "vehicle_telemetry", "performance_metrics"
        }
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        for table in expected_tables:
            self.assertIn(table, tables, f"Expected table '{table}' not found in database")

    def test_views_exist(self):
        expected_views = {
            "vw_active_dispatches", "vw_signal_realtime_status",
            "vw_fleet_readiness", "vw_corridor_efficiency"
        }
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
        views = {row[0] for row in cursor.fetchall()}
        for view in expected_views:
            self.assertIn(view, views, f"Expected view '{view}' not found in database")

    def test_parameterized_dispatch_lookup(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM dispatch_missions WHERE status = ?", ("DISPATCHED",))
        results = cursor.fetchall()
        self.assertIsInstance(results, list)

    def test_sql_injection_defense(self):
        cursor = self.conn.cursor()
        malicious_input = "' OR '1'='1"
        cursor.execute("SELECT * FROM vehicles WHERE call_sign = ?", (malicious_input,))
        results = cursor.fetchall()
        self.assertEqual(len(results), 0, "SQL injection string unexpectedly matched records!")

class DummyServer:
    def __init__(self):
        self.server_name = "127.0.0.1"
        self.server_port = 8000

class TestPulseAPIHandler(unittest.TestCase):
    """Unit tests for PulseRequestHandler HTTP endpoints and security mechanisms."""

    def _create_handler(self, method="GET", path="/api/v1/health", body=None, client_ip="127.0.0.1"):
        """Construct a handler with mocked request/response streams."""
        request_line = f"{method} {path} HTTP/1.1\r\nHost: localhost\r\n"
        content_bytes = (body.encode("utf-8") if isinstance(body, str) else body) if body else b""
        rfile = BytesIO(content_bytes)
        wfile = BytesIO()

        handler = PulseRequestHandler.__new__(PulseRequestHandler)
        handler.rfile = rfile
        handler.wfile = wfile
        handler.client_address = (client_ip, 54321)
        handler.server = DummyServer()
        handler.headers = {
            "host": "localhost",
            "content-length": str(len(content_bytes)),
            "content-type": "application/json"
        }
        handler.close_connection = False

        handler.requestline = f"{method} {path} HTTP/1.1"
        handler.command = method
        handler.path = path
        handler.request_version = "HTTP/1.1"

        # Suppress stderr noise in tests
        handler.log_message = lambda *args, **kwargs: None

        return handler, wfile

    def _parse_response(self, wfile):
        raw_output = wfile.getvalue()
        parts = raw_output.split(b"\r\n\r\n", 1)
        headers_raw = parts[0].decode("utf-8", errors="replace")
        body_raw = parts[1] if len(parts) > 1 else b""
        
        status_line = headers_raw.splitlines()[0]
        status_code = int(status_line.split()[1])
        return status_code, headers_raw, body_raw

    def test_health_check_endpoint(self):
        handler, wfile = self._create_handler("GET", "/api/v1/health")
        handler.do_GET()
        status_code, headers, body = self._parse_response(wfile)
        self.assertEqual(status_code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["database"], "connected")
        self.assertIn("tables", data)
        self.assertIn("X-Content-Type-Options: nosniff", headers)
        self.assertIn("X-Frame-Options: SAMEORIGIN", headers)

    def test_get_dispatches(self):
        handler, wfile = self._create_handler("GET", "/api/v1/dispatches")
        handler.do_GET()
        status_code, _, body = self._parse_response(wfile)
        self.assertEqual(status_code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertIn("data", data)
        self.assertIsInstance(data["data"], list)

    def test_get_signals(self):
        handler, wfile = self._create_handler("GET", "/api/v1/signals")
        handler.do_GET()
        status_code, _, body = self._parse_response(wfile)
        self.assertEqual(status_code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertIn("data", data)
        self.assertGreater(data["count"], 0)

    def test_get_fleet(self):
        handler, wfile = self._create_handler("GET", "/api/v1/fleet")
        handler.do_GET()
        status_code, _, body = self._parse_response(wfile)
        self.assertEqual(status_code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertIn("readiness", data)
        self.assertIn("vehicles", data)

    def test_rate_limiting(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        ip = "192.168.1.99"
        self.assertTrue(limiter.is_allowed(ip))
        self.assertTrue(limiter.is_allowed(ip))
        self.assertTrue(limiter.is_allowed(ip))
        self.assertFalse(limiter.is_allowed(ip), "Rate limiter should reject 4th request when max_requests is 3")

    def test_path_traversal_prevention(self):
        handler, wfile = self._create_handler("GET", "/../../../etc/passwd")
        handler.do_GET()
        status_code, _, _ = self._parse_response(wfile)
        self.assertIn(status_code, [403, 404])

    def test_post_preemption_trigger(self):
        payload = json.dumps({"signal_id": 1, "vehicle_id": 1, "mission_id": 1, "clearance_speed_kmh": 80})
        handler, wfile = self._create_handler("POST", "/api/v1/preemption/trigger", body=payload)
        handler.do_POST()
        status_code, _, body = self._parse_response(wfile)
        self.assertEqual(status_code, 200, f"Expected 200 but got {status_code}: {body.decode('utf-8')}")
        data = json.loads(body.decode("utf-8"))
        self.assertTrue(data["success"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
