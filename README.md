[Uploading README.md…]()
# Smart-Traffic-Emergency-Route-Management-# 🚨 Pulse · Smart Traffic & Emergency Route Management
**Project-Based Learning (PBL) — Operating Systems & DBMS**  
**Graphic Era University | Team T079 (Phase II)**

---

## 📌 Project Overview
# 🚨 Pulse · Smart Traffic & Emergency Route Management
**Project-Based Learning (PBL) — Operating Systems & DBMS**  
**Graphic Era University | Team T079 (Phase II)**

---

## 📌 Project Overview

**Pulse** is an enterprise-grade Smart Traffic and Emergency Route Management system designed to minimize emergency response times across the Mumbai Metropolitan Peninsula. The system simulates emergency response vehicles (Trauma Ambulances, Fire Tenders, Police Interceptors, Bike Medics) traversing high-density urban transit corridors, coordinating automated green-wave preemption at traffic signals as vehicles approach intersections.

The system combines:
1. **Threaded REST API Server** (`server.py`): Zero-dependency Python standard library HTTP server with rate limiting, parameterized queries, static asset caching, and security headers.
2. **Normalized Relational DBMS** (`database/pulse.db`): 9 tables, 4 analytical views, foreign-key cascade integrity, and B-tree indexes.
3. **Cartographic Dispatcher Dashboard** (`dashboard/index.html`): Real-time SVG map visualization, telemetry charts, fault-isolated components, persistent preferences, and diagnostic instrumentation.

---

## 📂 Repository Structure

```
├── dashboard/                 # Frontend Dispatcher Dashboard
│   ├── index.html            # Responsive cartographic web UI (6 tabs + SVG Mumbai map)
│   ├── css/theme.css         # Dark/light mode tokens, prefers-reduced-motion, glassmorphic styles
│   ├── js/api.js             # Resilient REST API client with request deduplication & offline cache
│   ├── js/preferences.js     # Versioned preference persistence (v1) & safe memory fallback
│   ├── js/diagnostics.js     # Observability, FPS monitor, PII sanitization & error ring-buffer
│   ├── js/error-boundary.js  # Component error boundary, fault isolation & loop breakers
│   ├── js/diagnostics-ui.js  # System health inspector & report export modal
│   └── assets/               # Fleet vehicle imagery (Ambulance, Fire, Police, Bike Medic)
│
├── database/                  # 🗄️ Database Layer (Schemas, Data & Integration)
│   ├── schema.sql            # Universal DDL schema (9 normalized tables, indexes, FKs)
│   ├── seed.sql              # Realistic Mumbai emergency transit seed dataset
│   ├── queries.sql           # Database views, REST API queries & analytical viva queries
│   ├── init_db.py            # Zero-dependency Python 3 + SQLite database builder
│   ├── pulse.db              # Pre-built SQLite database ready for immediate queries
│   ├── ER_DIAGRAM.md         # Mermaid ER model, data dictionary & 3NF normalization
│   └── README.md             # Complete handoff guide for backend & frontend team members
│
├── tests/                     # 🧪 Automated Test Suite
│   ├── test_capabilities.js  # Node.js tests for preferences, telemetry & error isolation
│   └── test_api_server.py    # Python tests for REST APIs, SQL injection, & rate limiting
│
├── server.py                  # Production ThreadingHTTPServer with REST APIs & security headers
├── run.py                     # Single-command launcher with auto-port allocation & DB check
└── start.sh                   # Unix shell wrapper for one-command execution
```

---

## 🚀 Quick Start (Single Command)

To initialize the database and start the production web and REST API server:

```bash
python3 run.py
```
*Or:*
```bash
./start.sh
```

*(Tip: pass `--open` if you want it to automatically launch your default browser, e.g. `python3 run.py --open`)*

---

## 🌐 REST API Endpoints

The server exposes standard JSON endpoints at `http://localhost:8000/api/v1/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/health` | Liveness & readiness probe, DB table status, version, uptime |
| `GET`  | `/api/v1/dispatches` | Active emergency missions from view `vw_active_dispatches` |
| `GET`  | `/api/v1/signals` | Real-time traffic signal states from `vw_signal_realtime_status` |
| `GET`  | `/api/v1/fleet` | Fleet readiness stats & vehicle inventory from `vehicles` |
| `GET`  | `/api/v1/corridors` | Corridor congestion & clearance efficiency from `vw_corridor_efficiency` |
| `GET`  | `/api/v1/incidents` | Incident backlog ordered chronologically |
| `POST` | `/api/v1/preemption/trigger` | Atomic signal green-wave preemption trigger |
| `POST` | `/api/v1/preemption/release` | Atomic signal release back to standard cyclic operation |
| `POST` | `/api/v1/dispatches/new` | Transactional dispatch mission creation |
| `POST` | `/api/v1/diagnostics/report` | Ingests client-side diagnostic errors and performance metrics |

---

## 🧪 Automated Testing

### 1. Python Backend & Database Verification
```bash
python3 tests/test_api_server.py
```
Verifies:
- Database table and view schema integrity
- Parameterized SQL injection defense
- REST API response format and status codes
- HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`)
- Rate limiting sliding window enforcement
- Path traversal defense against directory escape attacks

### 2. Frontend Capabilities & Fault Isolation Verification
```bash
node tests/test_capabilities.js
```
Verifies:
- User preference persistence (`PulsePreferences`) and fallback mechanisms
- Centralized telemetry, FPS tracking, and PII sanitization (`PulseDiagnostics`)
- Component-level fault isolation and simulation loop crash protection (`PulseErrorBoundary`)

**Pulse** is a Smart Traffic and Emergency Route Management dashboard designed to minimize emergency response times across the Mumbai Metropolitan Peninsula. The system simulates emergency vehicles (Ambulances, Fire Tenders, Police Interceptors, Bike Medics) traversing real-world transit corridors, coordinating automated green-wave preemption at traffic signals as vehicles approach intersections.

---

## 📂 Repository Structure

```
├── dashboard/                 # Frontend Dispatcher Dashboard
│   ├── index.html            # Monolithic responsive web UI (6 tabs + SVG Mumbai map)
│   └── assets/               # Fleet vehicle imagery (Ambulance, Fire, Police, Bike Medic)
│
└── database/                  # 🗄️ Database Layer (Schemas, Data & Integration)
    ├── schema.sql            # Universal DDL schema (9 normalized tables, indexes, FKs)
    ├── seed.sql              # Realistic Mumbai emergency transit seed dataset
    ├── queries.sql           # Database views, REST API queries & analytical viva queries
    ├── init_db.py            # Zero-dependency Python 3 + SQLite database builder
    ├── pulse.db              # Pre-built SQLite database ready for immediate queries
    ├── ER_DIAGRAM.md         # Mermaid ER model, data dictionary & 3NF normalization
    └── README.md             # Complete handoff guide for backend & frontend team members

```

---

## 🚀 Quick Start for Team Members

### 1. Run & Test the Database (30 seconds)
```bash
# Run from the project root:
python3 database/init_db.py
```
This builds and populates `database/pulse.db` with all tables, seeds, and views.

### 2. View the Frontend Dashboard
Simply open [`dashboard/index.html`](file:///Users/naitikdhiman/Desktop/untitled%20folder/dashboard/index.html) in any modern web browser (Chrome, Edge, Safari, Firefox).

### 3. Next Development Steps
- **For the Backend Developer:** Follow the API query guide in [`database/README.md`](file:///Users/naitikdhiman/Desktop/untitled%20folder/database/README.md) to wire Express.js or FastAPI endpoints to `pulse.db` or MySQL.
- **For the Routing Engine:** Integrate Dijkstra / A* route calculation over the node graph using the intersection coordinates provided in `traffic_signals` and `routes`.
- **For the Frontend Integrator:** Replace simulated in-memory variables in `dashboard/index.html` with `fetch()` calls to backend endpoints.
