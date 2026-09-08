# Stoqvia

AI-powered inventory risk detection and inter-store fulfilment coordination for multi-store retailers.

Stoqvia is a shared coordination layer for store teams. It brings demand-based risk detection, donor-store discovery, request broadcasting, stock verification, transfer tracking, and supplier fallback into one governed workflow, so employees spend less time on calls and more time on the shop floor.

## Product overview

Stoqvia is an inventory coordination product for multi-store retail networks. Store administrators log in to their own store, see which products are at risk over the next seven days, and raise a single fulfilment request instead of ringing neighbouring stores one by one.

It is designed for store managers and inventory coordinators who already know the operational problem: stock is fragmented across locations, shortage checks are slow, and the same request is explained repeatedly. Stoqvia connects four parts of that job: **prediction** (7-day demand and risk), **coordination** (broadcast requests and store responses), **fulfilment** (dispatch, in-transit tracking, and completion), and **automation** (due transfers complete without a manual chase).

The current repository is a working four-store Adelaide demonstration (Adelaide CBD, Marion, Mile End, and Modbury) with a React store console, a FastAPI backend, MongoDB, a LightGBM demand model, and a read-only Copilot over local Ollama.

## The problem

Inter-store replenishment often still runs on phone calls and local knowledge. When a store is short, an employee typically checks their own system, then calls other locations, waits for someone to confirm stock, records who said yes or no, and follows up on whether stock actually moved. If no store can help, they start a separate supplier conversation.

That process creates delay and duplicated work:

- Inventory truth is split across stores, so donor discovery is slow.
- The same shortage is explained on every call.
- Stock is verified by whoever answers the phone, not against a shared surplus rule.
- There is little visibility of who has accepted, declined, or gone quiet.
- Stock can be pulled from a store that also needs it, creating a second shortage.
- Supplier escalation is manual and easy to miss.
- Completion of in-transit stock is easy to forget.

Stoqvia is designed to reduce hours spent on those calls and that manual coordination. It does not claim a measured time or cost saving; those figures are not in this repository.

## How Stoqvia solves it

The implemented store workflow is:

1. **See the risk.** The Products view shows on-hand, reserved, usable stock, 7-day demand, shortage, and HIGH / MEDIUM / LOW risk.
2. **Open a request for a HIGH-risk product.** Request options load only when that product is HIGH risk at the signed-in store.
3. **Choose safe donors.** Only LOW-risk stores with a positive safe surplus are offered, grouped by distance band, with an estimated transfer lead.
4. **Broadcast one request.** Invite one or more eligible stores, optionally attach a note, and set a quantity (the predicted shortage is the default, not a cap). If no safe donor exists and an approved supplier does, the request can go straight to supplier fulfilment.
5. **Verify and respond.** Invited stores can check stock (exclusive lock), accept in full or in part up to their safe surplus, or decline with a required reason.
6. **Dispatch and track.** The requesting store confirms dispatch. Allocations move to in transit with a lead based on distance (store) or supplier lead time (purchase order).
7. **Escalate leftovers.** When invited stores cannot cover the remainder, Stoqvia creates a supplier purchase order for the leftover quantity, or marks the request declined if no supplier is available.
8. **Complete.** A background job completes transfers whose lead time has elapsed and records the operational history on the request.

```mermaid
flowchart TD
    A["HIGH-risk product or urgent request"] --> B["Check usable stock and 7-day demand"]
    B --> C["List LOW-risk donors with safe surplus"]
    C --> D{"Safe donors?"}
    D -->|Yes| E["Broadcast one request"]
    D -->|No, supplier exists| F["Supplier-only request"]
    E --> G["Stores check, accept, or decline"]
    G --> H{"Need covered?"}
    H -->|Yes| I["Dispatch and track transfer"]
    H -->|No| F
    I --> J["Auto-complete after lead time"]
    F --> J
```





## Business value


| Business challenge               | Stoqvia capability                                           | Operational value                                 |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Repeated calls between stores    | One request broadcast to eligible donors                     | The shortage is explained once, in the system     |
| Slow donor discovery             | Distance-banded stores with forecasted safe surplus          | Staff see who can help without ringing around     |
| Stockout risk                    | 7-day demand plus HIGH / MEDIUM / LOW classification         | Shortages are visible before the shelf is empty   |
| Unsafe transfers                 | Donors must stay LOW risk after the move                     | One store’s fill does not create another shortage |
| Fragmented tracking              | Sent, received, accepted, in-transit, and sent-history views | Status is shared instead of living in inboxes     |
| Supplier chase after stores fail | Automatic purchase order when invites cannot cover the need  | Fallback is part of the same request              |
| Routine completion chasing       | Timed completion of due in-transit allocations               | Lead-time follow-up does not rely on memory       |




## Key capabilities



### Inventory intelligence

- Store product catalogue with on-hand, reserved, usable, and safety stock
- Usable stock calculated as on-hand minus reserved (floored at zero)
- 7-day demand forecast per store and product
- Shortage and HIGH / MEDIUM / LOW risk on the Products view
- Copilot product search by name, SKU, category, or risk at the authenticated store



### Inter-store coordination

- Create-request screen for HIGH-risk products
- Broadcast to selected eligible stores, with an optional note (up to 500 characters)
- Sent and received request lists, plus accepted, in-transit, declined, and sent-history views
- Exclusive stock-check lock so two stores do not verify the same invite at once
- Full or partial accept, capped at remaining need and the donor’s safe surplus
- Decline requires a reason, shown on the request
- Request-level event history (who did what, and when)



### Fulfilment and transfers

- Donor comparison by distance band (under 15 km, 15–30 km, over 30 km) and transfer lead (1, 2, or 3 days)
- Requester dispatch after a store acceptance
- In-transit tracking until lead time elapses
- Detail view of invites, allocations, notes, declines, and any linked purchase order
- One active fulfilment at a time per store and product (open, fulfilled, or in transit)



### Supplier fallback

- Approved-supplier option on the request screen when stores cannot cover the need
- Supplier-only request when there are no safe donors
- Automatic purchase order for remaining quantity after invites are exhausted
- Purchase-order status on the transfer detail (including received when the supplier lead completes)



### Governance and control

- Store-admin login with HMAC-signed session tokens (default 12-hour expiry)
- Copilot and transfer APIs bind to the authenticated store; the model cannot choose another store’s identity
- Read-only Copilot tools and a fixed tool allowlist
- MongoDB JSON Schema validators on core collections
- Transfer event log for operational actions
- Copilot request logging (model, prompt version, tool name, duration)

**Not in this repository:** push notifications, enterprise identity providers, multi-role permissions beyond store admin, and authenticated access on catalogue/forecast GET routes (those reads are currently open).

## AI Copilot capabilities

Stoqvia Copilot turns a manager’s sentence into **one approved, read-only tool call**. It does not change inventory, create transfers, approve dispatch, or query MongoDB itself. Python services return stock and donor figures; the language model only selects a tool (or refuses).

Verified tools:


| Tool                     | What it does                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_products`        | Search the authenticated store’s forecasted catalogue by name, SKU, category, or HIGH / MEDIUM / LOW risk                                                                           |
| `recommend_donor_stores` | List nearby stores with backend-verified safe surplus for a product (from the selected product, a SKU in the question, or tool arguments), optionally filtered by a minimum surplus |


Unsupported questions return an out-of-scope response. Donor questions without a selected product or SKU return a clarification prompt.

```text
Manager question
    → Qwen tool selection (temperature 0, auto tool choice)
    → Trusted store and product arguments enforced in Python
    → One allowlisted read-only tool
    → Structured reply (product rows can open Create Request from the Copilot modal)
```

Implementation details confirmed in `backend/app/services/copilot_services.py`:

- Model: `qwen2.5:7b` via Ollama (`ChatOllama`), default base URL `http://localhost:11434`
- Timeout: 20 seconds
- Prompt version: `v1` (overridable)
- Kill switch: `COPILOT_ENABLED` (default `true`)

Safety principles:

- Read-only operation
- Approved tool allowlist only; unknown tools are rejected
- Authenticated store ID overwrites any store the model proposes
- No direct database access by the model
- No invented stock figures in the tool path (numbers come from forecast and request-option services)
- No autonomous transfer creation
- Prompt treated as untrusted; injection-style cases are included in the frozen eval

The Copilot is decision support. Employees still create, accept, and dispatch transfers in the application.

## Machine-learning and forecasting capabilities

LightGBM (or a weekday baseline) **forecasts 7-day unit demand**. Deterministic Python then combines that forecast with inventory to classify risk. The Copilot does not calculate risk, demand, distance, or surplus.

```text
Usable stock     = max(0, on-hand − reserved)
Projected stock  = usable stock − 7-day demand
Shortage         = max(0, 7-day demand + safety stock − usable stock)
Safe surplus     = max(0, usable stock − 7-day demand − 2 × safety stock)
```

Risk categories (`backend/app/models/forecast.py`):


| Risk   | Rule in code                                               | Plain language                                                        |
| ------ | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| HIGH   | Shortage greater than 0                                    | After covering 7-day demand, stock would sit below safety stock       |
| MEDIUM | No shortage, and projected stock is below 2 × safety stock | Above the safety floor, but close to the buffer                       |
| LOW    | Projected stock is at least 2 × safety stock               | Comfortably above the buffer; only these stores are offered as donors |


Demand model:

- Horizon: 7 days
- Lookback for the weekday fallback: last 28 days of `sales_daily`
- Primary method: LightGBM recursive next-day predictions (`FORECAST_MODEL=lightgbm`)
- Fallback: day-of-week averages (`FORECAST_MODEL=baseline`, or if LightGBM fails)
- Features: weekday, weekend flag, month, lag 1, lag 7, 7-day rolling mean, store index, product index
- Training: `python -m ml.train` writes `ml/artifacts/`

Sales in the demo are generated from `data/seed/json/sales_params.json`, not live tills.

## Automation

A FastAPI lifespan task starts `auto_complete_loop` when `AUTO_COMPLETE_INTERVAL_SECONDS` is greater than 0 (default **30 seconds**). On each tick it completes in-transit store transfers and supplier allocations whose lead time has passed, updates purchase orders to received where applicable, and writes system events. Setting the interval to `0` disables the job.

Shutdown sets a stop event and awaits the task, then closes the MongoDB client.

Staff can also trigger the same sweep with `POST /api/v1/transfers/jobs/complete-due` while authenticated.

`SUPPLIER_LEAD_MINUTES` can shorten supplier transit for local testing. `0` (default) uses seed `lead_days` as calendar days.

Automated: due-transfer completion. AI-assisted: Copilot recommendations. Employee-approved: create, respond, and dispatch.

## System architecture

The store console talks to FastAPI under `/api/v1`. Vite on port 5173 proxies `/api` to `http://127.0.0.1:8000`. MongoDB holds catalogue, inventory, sales, users, transfers, and purchase orders. Forecasting reads `sales_daily` and inventory. Copilot calls Ollama, then Python tools. The auto-complete job runs inside the API process.

```mermaid
flowchart LR
    UI["React store console"] --> API["FastAPI /api/v1"]
    API --> Mongo["MongoDB"]
    API --> Forecast["Forecast service"]
    Forecast --> LGBM["LightGBM or weekday baseline"]
    API --> Copilot["Copilot router"]
    Copilot --> Ollama["Ollama qwen2.5:7b"]
    Copilot --> Tools["Read-only Python tools"]
    Tools --> Forecast
    API --> Job["Auto-complete job"]
    Job --> Mongo
```





## Technology stack


| Area             | Technology                                                    |
| ---------------- | ------------------------------------------------------------- |
| Frontend         | React 19, TypeScript, Vite 6                                  |
| Backend          | FastAPI 0.115, Uvicorn, Pydantic v2                           |
| Database         | MongoDB 7 (Docker Compose), PyMongo                           |
| Authentication   | PBKDF2 password hashes, HMAC-SHA256 session tokens            |
| AI orchestration | LangChain tool binding (`ChatOllama`, `langchain_core.tools`) |
| Language model   | Qwen 2.5 7B hosted by Ollama                                  |
| Machine learning | LightGBM 4.6, NumPy                                           |
| Testing          | Pytest 8                                                      |
| Infrastructure   | Docker Compose for MongoDB only                               |


Copilot Python packages (`langchain-ollama` / `langchain-core`) are imported by the Copilot service and are not listed in `backend/requirements.txt`. Install them in the backend virtualenv if you enable Copilot.

## Repository structure

```text
stoqvia/
├── backend/                 API, services, jobs, Copilot, DB validators
├── frontend/                Store console (Vite + React)
├── data/seed/               JSON seed data and Mongo loaders
├── ml/                      LightGBM training and artifacts
├── evals/copilot/           Frozen Copilot cases, scorer, live runner
├── tests/                   Pytest suite
├── docker-compose.yml       Local MongoDB
└── .env.example             Backend environment template
```


| Path                     | Responsibility                                |
| ------------------------ | --------------------------------------------- |
| `backend/app/routers/`   | HTTP routes                                   |
| `backend/app/services/`  | Auth, inventory, forecast, transfers, Copilot |
| `backend/app/tools/`     | Allowlisted Copilot tools                     |
| `backend/app/jobs/`      | Due-transfer completion loop                  |
| `frontend/src/features/` | Products, requests, transfers, Copilot UI     |
| `evals/copilot/`         | Tool-choice evaluation                        |




## Getting started



### Prerequisites

- Python 3 (a virtualenv is expected under `backend/.venv`)
- Node.js and npm
- Docker (for MongoDB)
- [Ollama](https://ollama.com) and the `qwen2.5:7b` model, if you use Copilot
- On macOS, LightGBM may need `brew install libomp`



### Run locally

```bash
cp .env.example .env
docker compose up -d

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m scripts.init_db --reset

cd ..
PYTHONPATH=. backend/.venv/bin/python -m data.seed.seed_all
```

Seed path: JSON in `data/seed/json/` → MongoDB. `sales_daily.jsonl` is generated from `sales_params.json` during seed.

```bash
# API (from backend/)
cd backend
uvicorn app.main:app --reload --app-dir .

# Optional: train LightGBM (from repo root)
# Fallback without the model: FORECAST_MODEL=baseline
PYTHONPATH=.:backend backend/.venv/bin/python -m ml.train

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

- Store console: [http://localhost:5173](http://localhost:5173)
- OpenAPI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)



### Demo logins

These usernames are seed data for the local demonstration, not production secrets.


| Store        | Username        | Password     |
| ------------ | --------------- | ------------ |
| Adelaide CBD | `admin.cbd`     | `cbd123`     |
| Marion       | `admin.marion`  | `marion123`  |
| Mile End     | `admin.mileend` | `mileend123` |
| Modbury      | `admin.modbury` | `modbury123` |


Example catalogue SKU: `HW-PT-001` (Cordless Drill). After a reseed, sign in again so tokens stay valid.

### Seed collections


| Collection          | Source                                       |
| ------------------- | -------------------------------------------- |
| `products`          | `products.json`                              |
| `stores`            | `stores.json`                                |
| `inventory`         | `inventory.json`                             |
| `sales_daily`       | `sales_daily.jsonl` (built on seed)          |
| `suppliers`         | `suppliers.json`                             |
| `supplier_products` | `supplier_products.json`                     |
| `purchase_orders`   | `purchase_orders.json`                       |
| `stock_transfers`   | `stock_transfers.json`                       |
| `store_users`       | `store_users.json` (password hashed on load) |




## Environment configuration

Values below match `backend/app/config.py`, `.env.example`, and Copilot `os.getenv` defaults. Do not commit real secrets; replace `AUTH_SECRET` outside local demo use.


| Variable                         | Purpose                                           | Example / default                 | Required              |
| -------------------------------- | ------------------------------------------------- | --------------------------------- | --------------------- |
| `APP_NAME`                       | API title                                         | `Retail Inventory Copilot`        | No                    |
| `APP_ENV`                        | Environment label on `/health`                    | `development`                     | No                    |
| `API_PREFIX`                     | Route prefix                                      | `/api/v1`                         | No                    |
| `MONGO_URI`                      | MongoDB connection                                | `mongodb://localhost:27017`       | Yes for a running API |
| `MONGO_DB`                       | Database name                                     | `retail_inventory_copilot`        | No                    |
| `CORS_ORIGINS`                   | Allowed browser origins                           | Vite `localhost:5173`             | No                    |
| `FORECAST_MODEL`                 | `lightgbm` or `baseline`                          | `lightgbm`                        | No                    |
| `AUTH_SECRET`                    | HMAC key for session tokens                       | Dev placeholder in `.env.example` | Yes beyond demo       |
| `AUTH_TOKEN_HOURS`               | Token lifetime                                    | `12`                              | No                    |
| `AUTO_COMPLETE_INTERVAL_SECONDS` | Completion sweep; `0` disables                    | `30`                              | No                    |
| `SUPPLIER_LEAD_MINUTES`          | Test override for supplier transit; `0` uses days | `0`                               | No                    |
| `SEED_RANDOM_SEED`               | Seed generation                                   | `42`                              | No                    |
| `COPILOT_ENABLED`                | Copilot kill switch                               | `true`                            | No                    |
| `COPILOT_MODEL`                  | Ollama model name                                 | `qwen2.5:7b`                      | No                    |
| `COPILOT_BASE_URL`               | Ollama host                                       | `http://localhost:11434`          | No                    |
| `COPILOT_TIMEOUT_SECONDS`        | LLM / tool timeout                                | `20`                              | No                    |
| `COPILOT_PROMPT_VERSION`         | Logged prompt label                               | `v1`                              | No                    |


Copilot variables are read in application code and are not in `.env.example`.

## API overview

Interactive documentation: `/docs`. Prefix every path with `/api/v1`.


| Group           | Method and path                                          | Auth   |
| --------------- | -------------------------------------------------------- | ------ |
| System          | `GET /health`                                            | No     |
| Authentication  | `POST /auth/login`                                       | No     |
| Authentication  | `GET /auth/me`                                           | Bearer |
| Inventory       | `GET /stores`                                            | No     |
| Inventory       | `GET /stores/{store_id}/inventory`                       | No     |
| Inventory       | `GET /stores/{store_id}/products/{product_id}/inventory` | No     |
| Inventory       | `GET /products/{product_id}/network-inventory`           | No     |
| Forecast        | `GET /forecast/{store_id}/{product_id}`                  | No     |
| Forecast        | `GET /stores/{store_id}/forecasts`                       | No     |
| Request options | `GET /me/products/{product_id}/request-options`          | Bearer |
| Transfers       | `GET /transfers`                                         | Bearer |
| Transfers       | `POST /transfers`                                        | Bearer |
| Transfers       | `GET /transfers/{transfer_id}`                           | Bearer |
| Transfers       | `POST /transfers/{transfer_id}/respond`                  | Bearer |
| Transfers       | `POST /transfers/{transfer_id}/dispatch`                 | Bearer |
| Transfers       | `POST /transfers/jobs/complete-due`                      | Bearer |
| Copilot         | `POST /copilot/chat`                                     | Bearer |


There is no separate suppliers router. Supplier options appear on request-options and as purchase orders on a transfer.

## Testing and evaluation



### Software tests

From the repository root (MongoDB required for API tests):

```bash
backend/.venv/bin/python -m pytest
```

Coverage includes auth, inventory, forecasts, LightGBM features, geo bands, request options, transfer create/respond/dispatch, Copilot SKU handling, and Copilot parser/guardrail evals.

There is **no frontend test script** in `frontend/package.json`. Frontend checks in this repo are `npm run build` (TypeScript plus Vite production build).

### Copilot evaluation

Frozen cases live in `evals/copilot/copilot_cases.json`. Dimensions covered:

- Tool choice (search vs donor recommendation)
- Argument validity (SKU, `min_safe_surplus`)
- Clarification and out-of-scope refusals
- Prompt-injection and store-spoofing (trusted store ID must win)
- Hallucination-style questions that must not invent another store’s on-hand stock

Offline parser and trusted-argument tests run with the default pytest suite and do not call Ollama.

Live scoring against local Ollama:

```bash
COPILOT_EVAL=1 PYTHONPATH=.:backend backend/.venv/bin/python evals/copilot/run_copilot_eval.py
```

A recorded live run is stored in `evals/copilot/copilot_results.json` (`qwen2.5:7b`, prompt `v1`): **12 of 16 cases (75%)**. Failures were vague “this product” donor questions and a Marion on-hand question that returned clarification instead of out-of-scope. That snapshot will go stale when the prompt or model changes; re-run the command above to refresh it.

Latency is bounded by `COPILOT_TIMEOUT_SECONDS`; timeouts surface as Copilot errors, not as a separate latency dashboard.

## Security and responsible AI

Implemented:

- Login required for Copilot, transfers, and request options
- PBKDF2 password verification; HMAC-signed tokens (not a third-party JWT library)
- Store context taken from the token, not from the model
- Pydantic validation on requests
- Copilot allowlist, untrusted user text, and `[OUT_OF_SCOPE]` / `[CLARIFY]` prefixes
- Timeouts and exception logging on Copilot
- Secrets intended via environment variables (`AUTH_SECRET`, `MONGO_URI`)

Recommendations support an employee decision. Creating a request, accepting stock, and dispatching remain explicit API actions.

Gaps to treat as such: inventory and forecast GET routes do not require a token; default `AUTH_SECRET` is a development placeholder; Copilot LangChain packages are not pinned in `requirements.txt`.

