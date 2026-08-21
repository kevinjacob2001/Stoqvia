import { MetricGrid, SurfaceCard } from "../../../components/ui/index.ts";
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
      <SurfaceCard title="Request Summary">
        <MetricGrid
          variant="rows"
          items={[
            { label: "Product", value: options.product_name },
            { label: "SKU", value: options.sku },
            { label: "Quantity", value: pluralize(qty, "unit") },
            {
              label: selectedCount === 1 ? "Store can cover" : "Stores can cover",
              value: `up to ${pluralize(networkCover, "unit")}`,
              ok: true,
            },
            {
              label: "Supplier leftover",
              value: supplierRemainder > 0 ? pluralize(supplierRemainder, "unit") : "None",
            },
            { label: selectedCount === 1 ? "Store" : "Stores", value: `${selectedCount}` },
            {
              label: "Best lead time",
              value: bestLead != null ? leadTimeLabel(bestLead) : "—",
              ok: bestLead != null,
            },
            { label: "Fallback supplier", value: supplier?.name ?? "—" },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard title="Selected Stores Overview">
        <MetricGrid
          variant="rows"
          items={[
            { label: "Total selected", value: pluralize(selectedCount, "store") },
            { label: "Total safe surplus", value: pluralize(totalSurplus, "unit"), ok: true },
            {
              label: "Average lead time",
              value: avgLead != null ? leadTimeLabel(Math.round(avgLead)) : "—",
            },
            {
              label: "Nearest store",
              value: nearest ? `${nearest.store_name}, ${nearest.distance_km.toFixed(1)} km` : "—",
            },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard title="Next Steps">
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
      </SurfaceCard>
    </aside>
  );
}
