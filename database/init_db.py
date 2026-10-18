#!/usr/bin/env python3
"""
============================================================================
Pulse · Emergency Transit & Preemption System
DBMS & Operating Systems Project
Zero-Dependency Database Initializer (Python 3 + SQLite)
============================================================================
Usage:
    python3 database/init_db.py
Creates/populates 'database/pulse.db' using schema.sql and seed.sql.
"""

import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "pulse.db")
SCHEMA_FILE = os.path.join(BASE_DIR, "schema.sql")
SEED_FILE = os.path.join(BASE_DIR, "seed.sql")
QUERIES_FILE = os.path.join(BASE_DIR, "queries.sql")


def print_banner():
    print("=" * 70)
    print(" 🚨 PULSE EMERGENCY TRANSIT · DATABASE INITIALIZER")
    print("=" * 70)


def extract_views(queries_path):
    """Extract CREATE VIEW statements from queries.sql."""
    if not os.path.exists(queries_path):
        return ""
    with open(queries_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Split into statements and pick CREATE VIEW statements
    view_statements = []
    for stmt in content.split(";"):
        clean_stmt = stmt.strip()
        if "CREATE VIEW" in clean_stmt.upper():
            view_statements.append(clean_stmt)
    return ";\n\n".join(view_statements) + (";" if view_statements else "")


def init_database():
    print_banner()

    if os.path.exists(DB_FILE):
        print(f"[*] Removing existing database: {DB_FILE}")
        os.remove(DB_FILE)

    print(f"[*] Creating new database at: {DB_FILE}")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Execute Schema
    print("[*] Applying DDL Schema (schema.sql)...")
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    cursor.executescript(schema_sql)
    print("    [✓] Tables and indexes created successfully.")

    # 2. Execute Seed
    print("[*] Inserting realistic Mumbai seed data (seed.sql)...")
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        seed_sql = f.read()
    cursor.executescript(seed_sql)
    print("    [✓] Seed records inserted.")

    # 3. Create Views
    print("[*] Creating database views (queries.sql)...")
    views_sql = extract_views(QUERIES_FILE)
    if views_sql:
        cursor.executescript(views_sql)
        print("    [✓] Database views (vw_active_dispatches, etc.) registered.")

    conn.commit()

    # 4. Verification & Inspection
    print("\n" + "-" * 70)
    print(" 📊 VERIFICATION & TABLE SUMMARY")
    print("-" * 70)

    tables = [
        "vehicles",
        "traffic_signals",
        "incidents",
        "routes",
        "route_signals",
        "dispatch_missions",
        "preemption_logs",
        "vehicle_telemetry",
        "performance_metrics"
    ]

    for tbl in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
        cnt = cursor.fetchone()[0]
        print(f"  • Table '{tbl}': {cnt:>3} rows")

    print("\n" + "-" * 70)
    print(" 🚑 ACTIVE MISSIONS (from vw_active_dispatches)")
    print("-" * 70)
    cursor.execute("""
        SELECT mission_code, vehicle_name, incident_title, route_name, current_speed, current_progress_pct 
        FROM vw_active_dispatches;
    """)
    rows = cursor.fetchall()
    for r in rows:
        print(f"  • [{r[0]}] {r[1]} -> {r[2]}")
        print(f"    Corridor: {r[3]} | Speed: {r[4]} km/h | Progress: {r[5]}%")

    print("\n" + "-" * 70)
    print(" 🚥 TRAFFIC SIGNALS (from vw_signal_realtime_status)")
    print("-" * 70)
    cursor.execute("""
        SELECT signal_code, intersection_name, current_state, is_preempted, holding_vehicle 
        FROM vw_signal_realtime_status;
    """)
    sig_rows = cursor.fetchall()
    for s in sig_rows:
        preempt_tag = f"⚡ PREEMPTED by {s[4]}" if s[3] else "NORMAL CYCLE"
        print(f"  • [{s[0]}] {s[1]:<35} State: {s[2]:<10} ({preempt_tag})")

    conn.close()
    print("\n" + "=" * 70)
    print(" 🎉 DATABASE SETUP COMPLETE! 'pulse.db' is ready for use.")
    print("=" * 70)


if __name__ == "__main__":
    try:
        init_database()
    except Exception as e:
        print(f"\n[!] Error initializing database: {e}", file=sys.stderr)
        sys.exit(1)
