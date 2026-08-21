import { Button, ProductThumb, RiskBadge } from "../../components/ui/index.ts";
import { fulfillmentStatusLabel, type ActiveFulfillment } from "../../lib/fulfillments.ts";
import { stockToneFromRisk } from "../../lib/productDisplay.ts";
import type { ForecastResponse, InventoryItem } from "../../types.ts";

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
  const tone = stockToneFromRisk(forecast?.risk);

  return (
    <aside className="product-drawer" aria-label="Product detail">
      <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="drawer-hero">
        <ProductThumb name={item.product_name} size="lg" />
        <h2>{item.product_name}</h2>
        <p>SKU {item.sku}</p>
      </div>

      <dl className="drawer-metrics">
        <div>
          <dt>My Store</dt>
          <dd>
            {item.on_hand} units <span className={tone.className}>{tone.label}</span>
          </dd>
        </div>
        <div>
          <dt>Usable stock</dt>
          <dd>{item.usable_stock}</dd>
        </div>
        <div>
          <dt>Safety stock</dt>
          <dd>{item.safety_stock}</dd>
        </div>
        <div>
          <dt>7-day forecast</dt>
          <dd>{forecast?.predicted_7d_demand ?? "—"}</dd>
        </div>
        <div>
          <dt>Predicted shortage</dt>
          <dd>{forecast?.predicted_shortage_qty ?? "—"}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{forecast?.risk ? <RiskBadge risk={forecast.risk} /> : "—"}</dd>
        </div>
        <div>
          <dt>Supplier lead time</dt>
          <dd>8 days</dd>
        </div>
      </dl>

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
          {active.status === "IN_TRANSIT" ? (
            <Button variant="ghost" onClick={() => onTrackShipment(active.transferId)}>
              Track shipment
            </Button>
          ) : null}
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
