import type { DonorOption, RequestOptionsResponse, SupplierOption } from "../../../types.ts";
import { coverageSplit, leadTimeLabel, pluralize } from "../requestHelpers.ts";

type RequestSummaryPanelProps = {
  options: RequestOptionsResponse;
  qty: number;
  selectedStores: DonorOption[];
  supplier: SupplierOption | null;
};

export default function RequestSummaryPanel({
  options,
  qty,
  selectedStores,
  supplier,
}: RequestSummaryPanelProps) {
  const selectedCount = selectedStores.length;
  const { totalSurplus, networkCover, supplierRemainder } = coverageSplit(qty, selectedStores);
  const nearest = [...selectedStores].sort((a, b) => a.distance_km - b.distance_km)[0];
  const bestLead = selectedCount
    ? Math.min(...selectedStores.map((store) => store.lead_days))
    : null;
  const avgLead =
    selectedCount > 0
      ? selectedStores.reduce((sum, store) => sum + store.lead_days, 0) / selectedCount
      : null;

  return (
    <aside className="cr-sidebar">
      <section className="cr-card cr-summary">
        <h3>Request Summary</h3>
        <dl>
          <div>
            <dt>Product</dt>
            <dd>{options.product_name}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{options.sku}</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{pluralize(qty, "unit")}</dd>
          </div>
          <div>
            <dt>{selectedCount === 1 ? "Store can cover" : "Stores can cover"}</dt>
            <dd className="stock-ok">up to {pluralize(networkCover, "unit")}</dd>
          </div>
          <div>
            <dt>Supplier leftover</dt>
            <dd>{supplierRemainder > 0 ? pluralize(supplierRemainder, "unit") : "None"}</dd>
          </div>
          <div>
            <dt>{selectedCount === 1 ? "Store" : "Stores"}</dt>
            <dd>{selectedCount}</dd>
          </div>
          <div>
            <dt>Best lead time</dt>
            <dd className="stock-ok">{bestLead != null ? leadTimeLabel(bestLead) : "—"}</dd>
          </div>
          <div>
            <dt>Fallback supplier</dt>
            <dd>{supplier?.name ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="cr-card cr-summary">
        <h3>Selected Stores Overview</h3>
        <dl>
          <div>
            <dt>Total selected</dt>
            <dd>{pluralize(selectedCount, "store")}</dd>
          </div>
          <div>
            <dt>Total safe surplus</dt>
            <dd className="stock-ok">{pluralize(totalSurplus, "unit")}</dd>
          </div>
          <div>
            <dt>Average lead time</dt>
            <dd>{avgLead != null ? leadTimeLabel(Math.round(avgLead)) : "—"}</dd>
          </div>
          <div>
            <dt>Nearest store</dt>
            <dd>
              {nearest ? `${nearest.store_name}, ${nearest.distance_km.toFixed(1)} km` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="cr-card cr-summary">
        <h3>Next Steps</h3>
        <ol className="cr-next-steps">
          <li>
            {selectedCount === 0
              ? "Select at least one store to broadcast"
              : `Broadcast to ${pluralize(selectedCount, "selected store")}`}
          </li>
          <li>
            {selectedCount === 1
              ? "The store accepts up to its safe surplus"
              : "Stores accept up to their safe surplus"}
          </li>
          <li>Accepted qty is reserved, then dispatched</li>
          <li>
            {selectedCount === 0
              ? "Select stores to estimate supplier leftover"
              : supplierRemainder > 0
                ? `About ${pluralize(supplierRemainder, "unit")} may escalate to supplier if ${
                    selectedCount === 1 ? "the store cannot" : "stores cannot"
                  } cover`
                : selectedCount === 1
                  ? "The selected store can cover the full request if it accepts"
                  : "Selected stores can cover the full request if they all accept"}
          </li>
        </ol>
      </section>
    </aside>
  );
}
