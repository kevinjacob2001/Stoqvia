import "./ProductsPage.css";
import { useMemo, useState } from "react";
import { MetricCard, PageHeader, SearchField, Tabs } from "../../../components/ui/index.ts";
import type { ActiveFulfillment } from "../../../lib/fulfillments.ts";
import type { ForecastResponse, StoreInventoryResponse } from "../../../types.ts";
import ProductDrawer from "../ProductDrawer/index.ts";
import { filterProducts, PRODUCT_TABS, summarizeRisk, type ProductTabKey } from "../productFilters.ts";
import ProductsTable from "../ProductsTable/index.ts";

export type ProductsPageProps = {
  inventory: StoreInventoryResponse;
  forecasts: Record<string, ForecastResponse>;
  activeByProduct: Record<string, ActiveFulfillment>;
  onRequestProduct: (productId: string) => void;
  onTrackShipment: (transferId: string) => void;
};

export default function ProductsPage({
  inventory,
  forecasts,
  activeByProduct,
  onRequestProduct,
  onTrackShipment,
}: ProductsPageProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ProductTabKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => summarizeRisk(inventory.items, forecasts), [forecasts, inventory.items]);
  const filtered = useMemo(
    () => filterProducts(inventory.items, forecasts, activeByProduct, tab, query),
    [activeByProduct, forecasts, inventory.items, query, tab],
  );

  const selected = selectedId ? inventory.items.find((item) => item.product_id === selectedId) : null;

  return (
    <div className={`products-page${selected ? " with-drawer" : ""}`}>
      <PageHeader
        title="Products"
        subtitle={`${inventory.store_name} inventory and balancing`}
        meta={<span className="store-pill">{inventory.store_name}</span>}
      />

      <div className="toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by product name, SKU or ID…"
        />
      </div>

      <div className="metric-row">
        <MetricCard title="My Store Stock" value={`${stats.total}`} hint="SKUs on hand" tone="green" />
        <MetricCard title="High Risk" value={`${stats.high}`} hint="Need request soon" tone="orange" />
        <MetricCard title="Medium Risk" value={`${stats.medium}`} hint="Buffer thinning" tone="blue" />
        <MetricCard title="Supplier Lead Time" value="8 days" hint="Fallback PO average" tone="purple" />
      </div>

      <div className="products-panel">
        <Tabs items={PRODUCT_TABS} value={tab} onChange={setTab} />
        <ProductsTable
          items={filtered}
          totalCount={inventory.items.length}
          forecasts={forecasts}
          activeByProduct={activeByProduct}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRequestProduct={onRequestProduct}
          onTrackShipment={onTrackShipment}
        />
      </div>

      {selected ? (
        <ProductDrawer
          item={selected}
          forecast={forecasts[selected.product_id]}
          active={activeByProduct[selected.product_id]}
          onClose={() => setSelectedId(null)}
          onRequestProduct={onRequestProduct}
          onTrackShipment={onTrackShipment}
        />
      ) : null}
    </div>
  );
}
