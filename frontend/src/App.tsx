import { useCallback, useEffect, useState } from "react";
import { fetchStoreInventory, fetchStores } from "./api.ts";
import InventoryTable from "./sections/InventoryTable.tsx";
import LoadError from "./sections/LoadError.tsx";
import LoadingState from "./sections/LoadingState.tsx";
import StoreList from "./sections/StoreList.tsx";
import type { StoreInventoryResponse, StoreSummary } from "./types.ts";

export default function App() {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<StoreInventoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    setLoadingStores(true);
    setError(null);
    fetchStores()
      .then((rows) => {
        setStores(rows);
        setSelectedId((current) => current ?? rows[0]?.store_id ?? null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingStores(false));
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    setInventory(null);
    setLoadingInventory(true);
    fetchStoreInventory(selectedId)
      .then(setInventory)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingInventory(false));
  }, [selectedId, reloadKey]);

  return (
    <div className="shell">
      <header>
        <h1>Stoqvia</h1>
        <p>Inventory view — Phase 1</p>
      </header>
      {renderBody()}
    </div>
  );

  function renderBody() {
    if (loadingStores) {
      return <LoadingState message="Loading stores…" />;
    }

    if (error && stores.length === 0) {
      return <LoadError message={error} onRetry={retry} />;
    }

    return (
      <div className="layout">
        <StoreList stores={stores} selectedId={selectedId} onSelect={setSelectedId} />
        {renderInventoryPanel()}
      </div>
    );
  }

  function renderInventoryPanel() {
    if (error && stores.length > 0) {
      return <LoadError message={error} onRetry={retry} />;
    }
    if (loadingInventory || !inventory) {
      return (
        <section className="panel">
          <LoadingState message="Loading inventory…" />
        </section>
      );
    }
    return <InventoryTable inventory={inventory} />;
  }
}
