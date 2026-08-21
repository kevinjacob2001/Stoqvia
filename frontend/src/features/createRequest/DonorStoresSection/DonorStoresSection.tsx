import type { DonorOption } from "../../../types.ts";
import { forecastImpactLabel, leadTimeLabel } from "../requestHelpers.ts";

type DonorStoresSectionProps = {
  stores: DonorOption[];
  needQty: number;
  selectedIds: string[];
  onToggle: (storeId: string) => void;
  onClear: () => void;
  onSelectAll: () => void;
};

export default function DonorStoresSection({
  stores,
  needQty,
  selectedIds,
  onToggle,
  onClear,
  onSelectAll,
}: DonorStoresSectionProps) {
  return (
    <section className="cr-card">
      <div className="cr-section-head">
        <span className="cr-step">2</span>
        <div className="cr-section-title-row">
          <h2>Select Stores to Broadcast</h2>
          <div className="cr-section-actions">
            <span className="cr-selected-count">{selectedIds.length} stores selected</span>
            {selectedIds.length > 0 ? (
              <button type="button" className="cr-link" onClick={onClear}>
                Clear All
              </button>
            ) : (
              <button type="button" className="cr-link" onClick={onSelectAll}>
                Select All
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="cr-help">Only stores with safe surplus and within transfer eligibility are shown.</p>

      {stores.length === 0 ? (
        <p className="status">No eligible donor stores for this product.</p>
      ) : (
        <div className="table-wrap">
          <table className="cr-donor-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Store</th>
                <th>Distance</th>
                <th>Safe Surplus</th>
                <th>Lead Time</th>
                <th>Forecast Impact</th>
                <th className="num">Can send</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const checked = selectedIds.includes(store.store_id);
                const impact = forecastImpactLabel(store, needQty);
                const safe = store.safe_surplus > 0;
                return (
                  <tr key={store.store_id} className={checked ? "selected" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(store.store_id)}
                        aria-label={`Select ${store.store_name}`}
                      />
                    </td>
                    <td>
                      <strong>{store.store_name}</strong>
                    </td>
                    <td>{store.distance_km.toFixed(1)} km</td>
                    <td>
                      <span className={safe ? "cr-tag safe" : "cr-tag unsafe"}>
                        {store.safe_surplus} · {safe ? "Safe" : "Unsafe"}
                      </span>
                    </td>
                    <td>{leadTimeLabel(store.lead_days)}</td>
                    <td>
                      <span className={`cr-impact tone-${impact.tone}`}>{impact.label}</span>
                    </td>
                    <td className="num">{store.recommended_qty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="safe-surplus-tip cr-tip">
        <strong>What is Safe Surplus?</strong>
        <p>
          Units a store can spare while staying LOW risk after the transfer (covers 7-day demand and a healthy
          safety buffer).
        </p>
      </div>
    </section>
  );
}
