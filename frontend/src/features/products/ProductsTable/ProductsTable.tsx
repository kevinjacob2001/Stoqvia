import "./ProductsTable.css";
import { Button, IdentityCell, ProductThumb, RiskBadge } from "../../../components/ui/index.ts";
import { fulfillmentStatusLabel, type ActiveFulfillment } from "../../../lib/fulfillments.ts";
import { stockToneFromRisk } from "../../../lib/productDisplay.ts";
import type { ForecastResponse, InventoryItem } from "../../../types.ts";

type ProductsTableProps = {
  items: InventoryItem[];
  totalCount: number;
  forecasts: Record<string, ForecastResponse>;
  activeByProduct: Record<string, ActiveFulfillment>;
  selectedId: string | null;
  onSelect: (productId: string) => void;
  onRequestProduct: (productId: string) => void;
  onTrackShipment: (transferId: string) => void;
};

export default function ProductsTable({
  items,
  totalCount,
  forecasts,
  activeByProduct,
  selectedId,
  onSelect,
  onRequestProduct,
  onTrackShipment,
}: ProductsTableProps) {
  return (
    <>
      <div className="table-wrap">
        <table className="data-table products-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>My Store Stock</th>
              <th>Usable</th>
              <th>7-day forecast</th>
              <th>Shortage</th>
              <th>Risk</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const forecast = forecasts[item.product_id];
              const risk = forecast?.risk;
              const tone = stockToneFromRisk(risk);
              const active = activeByProduct[item.product_id];
              const shipmentComing = active?.status === "IN_TRANSIT";
              const requestBlocked = Boolean(active);

              return (
                <tr
                  key={item.product_id}
                  className={selectedId === item.product_id ? "selected" : undefined}
                  onClick={() => onSelect(item.product_id)}
                >
                  <td>
                    <IdentityCell
                      title={item.product_name}
                      subtitle={`SKU ${item.sku}`}
                      leading={<ProductThumb name={item.product_name} />}
                    />
                  </td>
                  <td>
                    <span className={`stock-pill ${tone.className}`}>
                      {item.on_hand} units {tone.label}
                    </span>
                  </td>
                  <td className="num">{item.usable_stock}</td>
                  <td className="num">{forecast?.predicted_7d_demand ?? "—"}</td>
                  <td className="num">{forecast?.predicted_shortage_qty ?? "—"}</td>
                  <td>{risk ? <RiskBadge risk={risk} /> : "—"}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div className="row-actions">
                      {shipmentComing && active ? (
                        <Button variant="ghost" onClick={() => onTrackShipment(active.transferId)}>
                          Track
                        </Button>
                      ) : null}
                      {risk === "HIGH" && !requestBlocked ? (
                        <Button variant="primary" onClick={() => onRequestProduct(item.product_id)}>
                          Request
                        </Button>
                      ) : null}
                      {risk === "HIGH" && requestBlocked && !shipmentComing && active ? (
                        <span className="muted-label">{fulfillmentStatusLabel(active.status)}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <p className="status">No products match this filter.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="table-footer">
        Showing {items.length} of {totalCount} products
      </p>
    </>
  );
}
