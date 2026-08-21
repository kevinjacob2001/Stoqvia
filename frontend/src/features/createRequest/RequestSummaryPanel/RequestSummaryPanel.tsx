import type { DonorOption, RequestOptionsResponse, SupplierOption } from "../../../types.ts";
import { coverageSplit, leadTimeLabel } from "../requestHelpers.ts";

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
  const { totalSurplus, networkCover, supplierRemainder } = coverageSplit(qty, selectedStores);
  const nearest = [...selectedStores].sort((a, b) => a.distance_km - b.distance_km)[0];
  const bestLead = selectedStores.length
    ? Math.min(...selectedStores.map((store) => store.lead_days))
    : null;
  const avgLead =
    selectedStores.length > 0
      ? selectedStores.reduce((sum, store) => sum + store.lead_days, 0) / selectedStores.length
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
            <dd>{qty} units</dd>
          </div>
          <div>
            <dt>Stores can cover</dt>
            <dd className="stock-ok">up to {networkCover} units</dd>
          </div>
          <div>
            <dt>Supplier leftover</dt>
            <dd>{supplierRemainder > 0 ? `${supplierRemainder} units` : "None"}</dd>
          </div>
          <div>
            <dt>Stores</dt>
            <dd>{selectedStores.length}</dd>
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
            <dt>Total stores selected</dt>
            <dd>{selectedStores.length}</dd>
          </div>
          <div>
            <dt>Total safe surplus</dt>
            <dd className="stock-ok">{totalSurplus} units</dd>
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
          <li>Broadcast to selected stores</li>
          <li>Stores accept up to their safe surplus</li>
          <li>Accepted qty is reserved, then dispatched</li>
          <li>
            {supplierRemainder > 0
              ? `About ${supplierRemainder} units may escalate to supplier if stores cannot cover`
              : "Selected stores can cover the full request if they all accept"}
          </li>
        </ol>
      </section>
    </aside>
  );
}
