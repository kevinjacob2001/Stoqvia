# Retail Inventory Copilot

Python FastAPI + MongoDB backend for an Australian hardware retail inventory system.

## Layout

```
retail-inventory-copilot/   (this repo)
├── backend/          FastAPI + PyMongo
├── frontend/         UI (placeholder)
├── data/             Seed / reference data
├── agents/           AI agents (later)
├── ml/               Forecasting models (later)
├── rag/              Supplier knowledge RAG (later)
├── simulation/       Digital twin (later)
├── tests/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quick start

```bash
# 1. Copy env
cp .env.example .env

# 2. Start MongoDB
docker compose up -d

# 3. Backend deps
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 4. Create collections + indexes
python -m scripts.init_db

# 5. Run API
uvicorn app.main:app --reload --app-dir .
```

API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/v1/health

## MongoDB collections (v1)

| Collection | Purpose |
|------------|---------|
| `products` | SKUs |
| `stores` | Store locations |
| `inventory` | Current on-hand by store × product |
| `sales_daily` | Daily sales aggregates |
| `suppliers` | Supplier master |
| `supplier_products` | Supplier ↔ product pricing / MOQ |
| `supplier_deliveries` | Inbound delivery history |
| `purchase_orders` | Purchase orders |
| `stock_transfers` | Inter-store transfers |
| `promotions` | Promo campaigns |
| `weather_daily` | Daily weather by store |

AI agents are not implemented yet.
