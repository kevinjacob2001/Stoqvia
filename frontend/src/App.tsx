import { useEffect, useState } from "react";
import { fetchStoreInventory, fetchStores } from "./api.ts";
import type { StoreInventoryResponse, StoreSummary } from "./types.ts";

export default function App() {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<StoreInventoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores()
      .then((rows) => {
        setStores(rows);
        if (rows[0]) {
          setSelectedId(rows[0].store_id);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    setInventory(null);
    fetchStoreInventory(selectedId)
      .then(setInventory)
      .catch((err: Error) => setError(err.message));
  }, [selectedId]);

  return (
    <div className="shell">
      <header>
        <h1>Stoqvia</h1>
        <p>Inventory view — Phase 1</p>
      </header>

      {error ? <p className="error">API error: {error}. Start the backend on port 8000.</p> : null}
      {loading ? <p className="status">Loading stores…</p> : null}

      <div className="layout">
        <aside className="panel">
          <strong>Stores</strong>
          <ul className="store-list">
            {stores.map((store) => (
              <li key={store.store_id}>
                <button
                  className={store.store_id === selectedId ? "active" : ""}
                  onClick={() => setSelectedId(store.store_id)}
                  type="button"
                >
                  {store.name}
                  <small>{store.region}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel">
          {inventory ? (
            <>
              <h2>
                {inventory.store_name}
                <small> · {inventory.item_count} products</small>
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">On hand</th>
                    <th className="num">Reserved</th>
                    <th className="num">Usable</th>
                    <th className="num">Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.items.map((item) => (
                    <tr
                      key={item.product_id}
                      className={item.usable_stock <= item.safety_stock ? "low" : undefined}
                    >
                      <td>{item.sku}</td>
                      <td>{item.product_name}</td>
                      <td className="num">{item.on_hand}</td>
                      <td className="num">{item.reserved}</td>
                      <td className="num">{item.usable_stock}</td>
                      <td className="num">{item.safety_stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="status">Select a store to view inventory.</p>
          )}
        </section>
      </div>
    </div>
  );
}
