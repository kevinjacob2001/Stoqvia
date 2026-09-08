import { Fragment, useMemo } from "react";
import { Pagination, SurfaceCard } from "../../../components/ui/index.ts";
import { TABLE_PAGE_SIZE } from "../../../lib/pagination.ts";
import { usePagedRows } from "../../../lib/usePagedRows.ts";
import type { DonorOption } from "../../../types.ts";
import { groupDonorsByDistance, leadTimeLabel, pluralize, sendImpactLabel } from "../requestHelpers.ts";

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
  const { page, setPage, visible: pageStores } = usePagedRows(stores, TABLE_PAGE_SIZE);
  const bands = useMemo(() => groupDonorsByDistance(pageStores), [pageStores]);
  const selectedCount = selectedIds.length;
  const showSelectionActions = stores.length > 0;

  return (
    <SurfaceCard>
      <div className="cr-section-head">
        <span className="cr-step">2</span>
        <div className="cr-section-title-row">
          <h2>Select Stores to Broadcast</h2>
          {showSelectionActions ? (
            <div className="cr-section-actions">
              <span className="cr-selected-count">{pluralize(selectedCount, "store")} selected</span>
              {selectedCount > 0 ? (
                <button type="button" className="cr-link" onClick={onClear}>
                  Clear All
                </button>
              ) : (
                <button type="button" className="cr-link" onClick={onSelectAll}>
                  Select All
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <p className="cr-help">
        {stores.length === 0
          ? "No eligible donor stores are available. Request from the supplier instead."
          : "Only stores with safe surplus are shown, grouped by distance (5 km, then 10 km, then 20 km). Empty bands are hidden."}
      </p>

      {stores.length === 0 ? (
        <p className="status">No eligible donor stores for this product.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="cr-donor-table">
              <thead>
                <tr>
                  <th aria-label="Select" />
                  <th>Store</th>
                  <th>Distance</th>
                  <th>Safe Surplus</th>
                  <th>Lead Time</th>
                  <th>Send impact</th>
                  <th className="num">Can send</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <Fragment key={band.key}>
                    <tr className="cr-band-row">
                      <td colSpan={7}>{band.label}</td>
                    </tr>
                    {band.stores.map((store) => {
                      const checked = selectedIds.includes(store.store_id);
                      const impact = sendImpactLabel(store, needQty);
                      const safe = store.safe_surplus > 0;
                      return (
                        <tr
                          key={store.store_id}
                          className={checked ? "selected" : undefined}
                          onClick={() => onToggle(store.store_id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onClick={(event) => event.stopPropagation()}
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
                          <td className="num">{Math.min(needQty, store.safe_surplus)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={stores.length} pageSize={TABLE_PAGE_SIZE} onChange={setPage} />
        </>
      )}

      <div className="safe-surplus-tip cr-tip">
        <strong>What is Safe Surplus?</strong>
        <p>
          Units a store can spare while staying LOW risk after the transfer (covers 7-day demand and a healthy
          safety buffer). Send impact is Low if they can cover the full request, Medium if only part, High if none.
        </p>
      </div>
    </SurfaceCard>
  );
}
