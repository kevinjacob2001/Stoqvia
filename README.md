# Stoqvia

Inter-store stock transfer made easy.

## Layout

```
stoqvia/
├── backend/                 FastAPI + PyMongo
├── data/seed/json/          Source-of-truth seed data
├── frontend/                React (Vite)
├── ml/                      LightGBM train + artifacts
├── docker-compose.yml
└── README.md
```

## Quick start

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

# API
cd backend
uvicorn app.main:app --reload --app-dir .

# Train LightGBM demand model (Phase 2b). Same forecast API as the weekday baseline.
# macOS: brew install libomp
# Fallback: FORECAST_MODEL=baseline
cd ..
PYTHONPATH=.:backend backend/.venv/bin/python -m ml.train

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Seed flow: JSON files in `data/seed/json/` → MongoDB.  
`sales_daily.jsonl` is generated from `sales_params.json`, then loaded.

## MVP collections

| Collection | JSON file |
|------------|-----------|
| `products` | `products.json` |
| `stores` | `stores.json` |
| `inventory` | `inventory.json` |
| `sales_daily` | `sales_daily.jsonl` (built on seed) |
| `suppliers` | `suppliers.json` |
| `supplier_products` | `supplier_products.json` |
| `purchase_orders` | `purchase_orders.json` |
| `stock_transfers` | `stock_transfers.json` |
| `store_users` | `store_users.json` (password hashed on load) |
