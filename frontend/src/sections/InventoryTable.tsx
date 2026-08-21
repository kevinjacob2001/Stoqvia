import type { ForecastResponse, OutgoingTransfer, StoreInventoryResponse } from "../types.ts";

export type ActiveFulfillment = {
  transferId: string;
  status: string;
  qty: number;
};

type InventoryTableProps = {
  inventory: StoreInventoryResponse;
  forecasts: Record<string, ForecastResponse>;
  activeByProduct: Record<string, ActiveFulfillment>;
  onRequestProduct: (productId: string) => void;
  onTrackShipment: (transferId: string) => void;
};

const ACTIVE_STATUSES = new Set(["OPEN", "FULFILLED", "IN_TRANSIT"]);

export function buildActiveFulfillments(outgoing: OutgoingTransfer[]): Record<string, ActiveFulfillment> {
  const byProduct: Record<string, ActiveFulfillment> = {};
  for (const row of outgoing) {
    if (!ACTIVE_STATUSES.has(row.status)) continue;
    const existing = byProduct[row.product_id];
    // Prefer in-transit over earlier stages when multiple somehow exist.
    if (!existing || row.status === "IN_TRANSIT" || (existing.status !== "IN_TRANSIT" && row.status === "FULFILLED")) {
      byProduct[row.product_id] = {
        transferId: row.transfer_id,
        status: row.status,
        qty: row.qty,
      };
    }
  }
  return byProduct;
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3 7h11v8H3V7zm12 2h3.5L21 12.5V15h-1.1a2.5 2.5 0 0 1-4.8 0H13v-2h2V9zm1.5 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM7 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 15h6v1.1a2.5 2.5 0 0 1-4.9.4H5V15z"
      />
    </svg>
  );
}

export default function InventoryTable({
  inventory,
  forecasts,
  activeByProduct,
  onRequestProduct,
  onTrackShipment,
}: InventoryTableProps) {
  return (
    <section className="panel">
      <h2>Inventory</h2>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="num">On hand</th>
            <th className="num">Usable</th>
            <th className="num">7-day forecast</th>
            <th className="num">Safety</th>
            <th className="num">Shortage</th>
            <th>Risk</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {inventory.items.map((item) => {
            const forecast = forecasts[item.product_id];
            const risk = forecast?.risk;
            const active = activeByProduct[item.product_id];
            const shipmentComing = active?.status === "IN_TRANSIT";
            const requestBlocked = Boolean(active);

            return (
              <tr key={item.product_id}>
                <td>{item.sku}</td>
                <td>{item.product_name}</td>
                <td className="num">{item.on_hand}</td>
                <td className="num">{item.usable_stock}</td>
                <td className="num">{forecast?.predicted_7d_demand ?? "—"}</td>
                <td className="num">{item.safety_stock}</td>
                <td className="num">{forecast?.predicted_shortage_qty ?? "—"}</td>
                <td>
                  {risk ? <span className={`risk risk-${risk.toLowerCase()}`}>{risk}</span> : "—"}
                </td>
                <td>
                  {shipmentComing ? (
                    <div className="shipment-affordance">
                      <button
                        className="icon-button shipment-truck"
                        type="button"
                        aria-label="Shipment in progress"
                        title="Shipment in progress"
                      >
                        <TruckIcon />
                      </button>
                      <div className="shipment-popover" role="tooltip">
                        <strong>Shipment in progress</strong>
                        <span>{active.qty} units inbound</span>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => onTrackShipment(active.transferId)}
                        >
                          Track shipment
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {risk === "HIGH" && !requestBlocked ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onRequestProduct(item.product_id)}
                    >
                      Request
                    </button>
                  ) : null}
                  {risk === "HIGH" && requestBlocked && !shipmentComing ? (
                    <span className="muted-label">
                      {active.status === "FULFILLED" ? "Awaiting dispatch" : "Request pending"}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
