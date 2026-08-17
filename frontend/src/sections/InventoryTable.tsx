import type { StoreInventoryResponse } from "../types.ts";

type InventoryTableProps = {
  inventory: StoreInventoryResponse;
};

export default function InventoryTable({ inventory }: InventoryTableProps) {
  return (
    <section className="panel">
      <h2>
        {inventory.store_name}
        <small> · {inventory.item_count} products</small>
      </h2>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="num">On hand</th>
            <th className="num">Reserved</th>
            <th className="num">Usable</th>
            <th className="num">Safety</th>
          </tr>
        </thead>
        <tbody>
          {inventory.items.map((item) => (
            <tr
              key={item.product_id}
              className={item.usable_stock <= item.safety_stock ? "low" : undefined}
            >
              <td>{item.sku}</td>
              <td>{item.product_name}</td>
              <td className="num">{item.on_hand}</td>
              <td className="num">{item.reserved}</td>
              <td className="num">{item.usable_stock}</td>
              <td className="num">{item.safety_stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
