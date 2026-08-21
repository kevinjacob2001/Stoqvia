import "./ProductsTable.css";
import { Button, IdentityCell, ProductThumb, RiskBadge } from "../../../components/ui/index.ts";
import { fulfillmentStatusLabel, type ActiveFulfillment } from "../../../lib/fulfillments.ts";
import type { ForecastResponse, InventoryItem } from "../../../types.ts";

type ProductsTableProps = {
  items: InventoryItem[];
  totalCount: number;
  forecasts: Record<string, ForecastResponse>;
  activeByProduct: Record<string, ActiveFulfillment>;
  selectedId: string | null;
  onSelect: (productId: string) => void;
  onTrackShipment: (transferId: string) => void;
};

export default function ProductsTable({
  items,
  totalCount,
  forecasts,
  activeByProduct,
  selectedId,
  onSelect,
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
              const active = activeByProduct[item.product_id];
              const shipmentComing = active?.status === "IN_TRANSIT";

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
                  <td>{item.on_hand} units</td>
                  <td className="num">{item.usable_stock}</td>
                  <td className="num">{forecast?.predicted_7d_demand ?? "—"}</td>
                  <td className="num">{forecast?.predicted_shortage_qty ?? "—"}</td>
                  <td>{risk ? <RiskBadge risk={risk} /> : "—"}</td>
                  <td>
                    <div className="row-actions">
                      {shipmentComing && active ? (
                        <Button
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTrackShipment(active.transferId);
                          }}
                        >
                          Track
                        </Button>
                      ) : null}
                      {risk === "HIGH" && active && !shipmentComing ? (
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
