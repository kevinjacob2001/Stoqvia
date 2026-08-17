import type { StoreSummary } from "../types.ts";

type StoreListProps = {
  stores: StoreSummary[];
  selectedId: string | null;
  onSelect: (storeId: string) => void;
};

export default function StoreList({ stores, selectedId, onSelect }: StoreListProps) {
  return (
    <aside className="panel">
      <strong>Stores</strong>
      <ul className="store-list">
        {stores.map((store) => (
          <li key={store.store_id}>
            <button
              className={store.store_id === selectedId ? "active" : ""}
              onClick={() => onSelect(store.store_id)}
              type="button"
            >
              {store.name}
              <small>{store.region}</small>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
