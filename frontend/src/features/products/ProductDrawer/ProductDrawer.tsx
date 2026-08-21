import "./ProductDrawer.css";
import { Button, MetricGrid, ProductThumb, RiskBadge } from "../../../components/ui/index.ts";
import { fulfillmentStatusLabel, type ActiveFulfillment } from "../../../lib/fulfillments.ts";
import type { ForecastResponse, InventoryItem } from "../../../types.ts";

type ProductDrawerProps = {
  item: InventoryItem;
  forecast?: ForecastResponse;
  active?: ActiveFulfillment;
  onClose: () => void;
  onRequestProduct: (productId: string) => void;
  onTrackShipment: (transferId: string) => void;
};

export default function ProductDrawer({
  item,
  forecast,
  active,
  onClose,
  onRequestProduct,
  onTrackShipment,
}: ProductDrawerProps) {
  return (
    <aside className="product-drawer" aria-label="Product detail">
      <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="drawer-hero">
        <ProductThumb name={item.product_name} sku={item.sku} size="lg" />
        <h2>{item.product_name}</h2>
        <p>SKU {item.sku}</p>
      </div>

      <MetricGrid
        variant="rows"
        items={[
          { label: "My Store", value: `${item.on_hand} units` },
          { label: "Usable stock", value: `${item.usable_stock}` },
          { label: "Safety stock", value: `${item.safety_stock}` },
          { label: "7-day forecast", value: `${forecast?.predicted_7d_demand ?? "—"}` },
          { label: "Predicted shortage", value: `${forecast?.predicted_shortage_qty ?? "—"}` },
          { label: "Risk", value: forecast?.risk ? <RiskBadge risk={forecast.risk} /> : "—" },
          { label: "Supplier lead time", value: "8 days" },
        ]}
      />

      {forecast?.risk === "HIGH" && !active ? (
        <Button variant="primary" className="drawer-cta" onClick={() => onRequestProduct(item.product_id)}>
          Request This Product
        </Button>
      ) : null}

      {active ? (
        <div className="drawer-note">
          <p>
            {fulfillmentStatusLabel(active.status)} · {active.qty} units
          </p>
          <Button
            variant="primary"
            className="drawer-cta"
            onClick={() => onTrackShipment(active.transferId)}
          >
            Track product status
          </Button>
        </div>
      ) : null}

      <div className="safe-surplus-tip">
        <strong>What is risk?</strong>
        <p>
          HIGH means usable stock cannot cover 7-day demand plus safety stock. Request from nearby stores with safe
          surplus, or escalate leftover need to supplier.
        </p>
      </div>
    </aside>
  );
}
