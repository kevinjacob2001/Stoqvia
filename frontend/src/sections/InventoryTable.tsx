import type { ForecastResponse, StoreInventoryResponse } from "../types.ts";

type InventoryTableProps = {
  inventory: StoreInventoryResponse;
  forecasts: Record<string, ForecastResponse>;
  onRequestProduct: (productId: string) => void;
};

export default function InventoryTable({
  inventory,
  forecasts,
  onRequestProduct,
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
            return (
              <tr key={item.product_id} className={risk === "HIGH" ? "low" : undefined}>
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
                  {risk === "HIGH" ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onRequestProduct(item.product_id)}
                    >
                      Request
                    </button>
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
