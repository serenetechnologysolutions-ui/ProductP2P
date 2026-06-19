# How to Run ProcureTrack (P2P) Locally

This project has four parts. For day-to-day development you only need the
first two; the demo app and document-intelligence service are optional.

| Part | Folder | Tech | Port |
|---|---|---|---|
| Backend API | `backend/` | Node.js + Express + MySQL | 5000 |
| Main frontend | `frontend/` | React (CRA) + Ant Design | 3000 |
| Demo frontend (optional) | `demo-procuretrack/` | React (CRA) | 3000* |
| Document Intelligence (optional) | `document-intelligence/` | Python + FastAPI | 8000 (default) |

\* Run only one CRA app at a time, or set `PORT` to avoid a clash with the main frontend.

## Prerequisites

- Node.js 18+ and npm
- MySQL 8.x running locally
- Python 3.10+ (only if you need the document-intelligence service)

## 1. Database setup

The backend expects a MySQL server reachable with the credentials in
`backend/.env` (already present in this checkout — do not commit it).
Key variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

Make sure MySQL is running, then create the schema:

```bash
cd backend
npm install
npm run migrate        # creates the vendor_portal DB + all tables, including the RFQ module
```

Seed sample data (sub-masters, demo users, vendors, POs, sample RFQs/bids, etc.):

```bash
npm run seed
```

> Alternative: if you'd rather import a known-good snapshot instead of
> running migrations, load `db-full-dump.sql` or `db-schema.sql` from the
> repo root directly with `mysql -u root -p < db-full-dump.sql`.

After seeding, default login credentials are printed to the console, e.g.:

```
Admin:       admin@vendorportal.com / Admin@123
Procurement: procurement@vendorportal.com / Proc@123
Vendor:      vendor1@tatasteel.com / Vendor@123
```

## 2. Backend API

```bash
cd backend
npm install      # if not already done above
npm run dev       # nodemon, auto-restarts on change — recommended for dev
# or
npm start         # plain node, no auto-restart
```

The server starts on `http://localhost:5000` (configurable via `PORT` in
`backend/.env`). Health check: `GET http://localhost:5000/api/health`.

## 3. Frontend

The frontend talks to the backend at a hardcoded `http://localhost:5000/api`
(see `frontend/src/api/axios.js`), so the backend must be running first.

```bash
cd frontend
npm install
npm start
```

Opens at `http://localhost:3000`.

## 4. Document Intelligence service (optional)

Only needed if you're testing PO/ASN document extraction features that call
out to `DOCUMENT_INTELLIGENCE_URL` (set in `backend/.env`).

```bash
cd document-intelligence
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Make sure `DOCUMENT_INTELLIGENCE_URL` in `backend/.env` points at this
service's URL (e.g. `http://localhost:8000`).

## 5. Demo app (optional)

`demo-procuretrack/` is a separate, standalone React app (not wired to the
backend). Run it only if you need to look at the demo UI in isolation:

```bash
cd demo-procuretrack
npm install
npm start
```

It defaults to port 3000 like the main frontend — stop the main frontend
first, or run with `PORT=3001 npm start`.

## Typical full dev startup (3 terminals)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start

# Terminal 3 (optional)
cd document-intelligence && uvicorn main:app --reload --port 8000
```

Then visit `http://localhost:3000` and log in with one of the seeded
accounts above.
