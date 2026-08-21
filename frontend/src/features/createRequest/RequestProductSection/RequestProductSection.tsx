import { Button, ProductThumb } from "../../../components/ui/index.ts";
import type { InventoryItem, RequestOptionsResponse } from "../../../types.ts";

type RequestProductSectionProps = {
  options: RequestOptionsResponse;
  inventoryItem?: InventoryItem;
  qty: number;
  onQtyChange: (qty: number) => void;
};

export default function RequestProductSection({
  options,
  inventoryItem,
  qty,
  onQtyChange,
}: RequestProductSectionProps) {
  const onHand = inventoryItem?.on_hand ?? null;

  return (
    <section className="cr-card">
      <div className="cr-section-head">
        <span className="cr-step">1</span>
        <h2>Product &amp; Request Details</h2>
      </div>

      <div className="cr-product-row">
        <div className="cr-product-identity">
          <ProductThumb name={options.product_name} />
          <div>
            <strong>{options.product_name}</strong>
            <small>SKU {options.sku}</small>
          </div>
        </div>
        {onHand != null ? (
          <div className="cr-stock-status">
            <span>My Store Stock: {onHand} units</span>
          </div>
        ) : null}
      </div>

      <div className="cr-form-row">
        <label className="cr-field">
          <span>Quantity Required</span>
          <div className="cr-stepper">
            <Button
              variant="ghost"
              disabled={qty <= 1}
              onClick={() => onQtyChange(Math.max(1, qty - 1))}
              aria-label="Decrease quantity"
            >
              −
            </Button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(event) => onQtyChange(Math.max(1, Number(event.target.value) || 1))}
            />
            <Button variant="ghost" onClick={() => onQtyChange(qty + 1)} aria-label="Increase quantity">
              +
            </Button>
            <span className="cr-unit">units</span>
          </div>
        </label>
      </div>

      <label className="cr-field cr-notes">
        <span>Notes (optional)</span>
        <div className="cr-notes-locked">
          Currently disabled
        </div>
      </label>
    </section>
  );
}
