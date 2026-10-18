#!/usr/bin/env python3
"""
============================================================================
Pulse · Smart Traffic & Emergency Route Management
One-Command Launcher (Production Threaded REST API & Frontend Server)
============================================================================
Usage:
    python3 run.py
    or
    ./start.sh

Options:
    --open    Automatically open the browser (disabled by default)
============================================================================
"""

import os
import sys
import socket
import webbrowser
import subprocess
from http.server import ThreadingHTTPServer

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_FILE = os.path.join(PROJECT_ROOT, "dashboard", "index.html")
DB_FILE = os.path.join(PROJECT_ROOT, "database", "pulse.db")
INIT_DB_SCRIPT = os.path.join(PROJECT_ROOT, "database", "init_db.py")

# Import the production request handler
try:
    from server import PulseRequestHandler
except ImportError:
    from http.server import SimpleHTTPRequestHandler
    class PulseRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=PROJECT_ROOT, **kwargs)


def find_free_port(start_port=8000, max_port=8050):
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


def ensure_database():
    print("=" * 60)
    print(" 🚨 PULSE · SMART TRAFFIC & EMERGENCY ROUTE MANAGEMENT")
    print("=" * 60)
    
    if not os.path.exists(DB_FILE):
        print("\n[*] Initializing database for the first time...")
        subprocess.run([sys.executable, INIT_DB_SCRIPT], check=True)
    else:
        print("\n[✓] Database ready at database/pulse.db")
        print("    (Tip: Run 'python3 database/init_db.py' if you want to re-seed)")


def main():
    os.chdir(PROJECT_ROOT)
    auto_open = "--open" in sys.argv
    
    # 1. Verify/Initialize Database
    ensure_database()
    
    # 2. Try starting Threaded HTTP & REST Server
    port = find_free_port(8000)
    server_address = ("127.0.0.1", port)
    dashboard_url = f"http://localhost:{port}/dashboard/"
    api_health_url = f"http://localhost:{port}/api/v1/health"
    
    try:
        httpd = ThreadingHTTPServer(server_address, PulseRequestHandler)
        print("\n" + "-" * 60)
        print(" 🌐 PULSE PRODUCTION SERVER RUNNING")
        print("-" * 60)
        print(f"  • Open Dashboard : {dashboard_url}")
        print(f"  • REST API Probe : {api_health_url}")
        print(f"  • Local Host     : 127.0.0.1:{port}")
        print(f"  • Project Root   : {PROJECT_ROOT}")
        print("\n  👉 Press Ctrl + C anytime to stop the server.")
        print("-" * 60 + "\n")
        
        if auto_open:
            print(f"[*] Opening browser to: {dashboard_url}")
            webbrowser.open(dashboard_url)

        httpd.serve_forever()

    except (PermissionError, OSError):
        file_url = f"file://{os.path.abspath(DASHBOARD_FILE)}"
        print("\n[!] Local network binding unavailable or restricted.")
        print(f"[*] You can view the dashboard directly at:\n    {file_url}")
        if auto_open:
            webbrowser.open(file_url)
    except KeyboardInterrupt:
        print("\n\n[*] Shutting down Pulse server... Goodbye! 🚨")
        try:
            httpd.server_close()
        except Exception:
            pass
        sys.exit(0)


if __name__ == "__main__":
    main()
