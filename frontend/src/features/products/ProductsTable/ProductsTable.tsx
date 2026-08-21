import "./ProductsTable.css";
import { IdentityCell, Pagination, ProductThumb, RiskBadge } from "../../../components/ui/index.ts";
import { fulfillmentStatusLabel, type ActiveFulfillment } from "../../../lib/fulfillments.ts";
import { TABLE_PAGE_SIZE } from "../../../lib/pagination.ts";
import { usePagedRows } from "../../../lib/usePagedRows.ts";
import type { ForecastResponse, InventoryItem } from "../../../types.ts";

type ProductsTableProps = {
  items: InventoryItem[];
  totalCount: number;
  forecasts: Record<string, ForecastResponse>;
  activeByProduct: Record<string, ActiveFulfillment>;
  selectedId: string | null;
  onSelect: (productId: string) => void;
};

export default function ProductsTable({
  items,
  totalCount,
  forecasts,
  activeByProduct,
  selectedId,
  onSelect,
}: ProductsTableProps) {
  const { page, setPage, visible: rows } = usePagedRows(items, TABLE_PAGE_SIZE);

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
            {rows.map((item) => {
              const forecast = forecasts[item.product_id];
              const risk = forecast?.risk;
              const active = activeByProduct[item.product_id];

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
                      leading={
                        <ProductThumb
                          name={item.product_name}
                          sku={item.sku}
                          imageUrl={item.image_url}
                          productUrl={item.product_url}
                        />
                      }
                    />
                  </td>
                  <td>{item.on_hand} units</td>
                  <td className="num">{item.usable_stock}</td>
                  <td className="num">{forecast?.predicted_7d_demand ?? "—"}</td>
                  <td className="num">{forecast?.predicted_shortage_qty ?? "—"}</td>
                  <td>{risk ? <RiskBadge risk={risk} /> : "—"}</td>
                  <td>
                    {active ? (
                      <span className="muted-label">{fulfillmentStatusLabel(active.status)}</span>
                    ) : null}
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
      <Pagination page={page} total={items.length} pageSize={TABLE_PAGE_SIZE} onChange={setPage} />
      <p className="table-footer">
        {items.length} filtered · {totalCount} products total
      </p>
    </>
  );
}
