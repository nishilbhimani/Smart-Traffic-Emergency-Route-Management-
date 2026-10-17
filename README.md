[README.md](https://github.com/user-attachments/files/33597362/README.md)
# Smart-Traffic-Emergency-Route-Management-# 🚨 Pulse · Smart Traffic & Emergency Route Management
**Project-Based Learning (PBL) — Operating Systems & DBMS**  
**Graphic Era University | Team T079 (Phase II)**

---

## 📌 Project Overview

**Pulse** is a Smart Traffic and Emergency Route Management dashboard designed to minimize emergency response times across the Mumbai Metropolitan Peninsula. The system simulates emergency vehicles (Ambulances, Fire Tenders, Police Interceptors, Bike Medics) traversing real-world transit corridors, coordinating automated green-wave preemption at traffic signals as vehicles approach intersections.

---

## 📂 Repository Structure

```
├── dashboard/                 # Frontend Dispatcher Dashboard
│   ├── index.html            # Monolithic responsive web UI (6 tabs + SVG Mumbai map)
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
└── extracted_phase2/         # University Phase-II LaTeX report documentation
    └── main.tex              # Academic project progress report
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
