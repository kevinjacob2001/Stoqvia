import type { SupplierOption } from "../../../types.ts";
import { leadTimeLabel } from "../requestHelpers.ts";

type SupplierFallbackSectionProps = {
  supplier: SupplierOption | null;
};

export default function SupplierFallbackSection({ supplier }: SupplierFallbackSectionProps) {
  return (
    <section className="cr-card">
      <div className="cr-section-head">
        <span className="cr-step">3</span>
        <div>
          <h2>Supplier Fallback</h2>
          <p className="cr-help">
            If none of the selected stores can fulfil, this supplier will be considered automatically.
          </p>
        </div>
      </div>

      {supplier ? (
        <div className="cr-supplier-row">
          <div className="cr-supplier-identity">
            <div className="cr-supplier-mark">{supplier.name.slice(0, 1)}</div>
            <div>
              <strong>{supplier.name}</strong>
              <small>
                Preferred · Order qty {supplier.recommended_qty}
              </small>
            </div>
          </div>
          <div className="cr-supplier-meta">
            <div>
              <span className="cr-meta-label">Available</span>
              <strong className="stock-ok">Yes</strong>
            </div>
            <div>
              <span className="cr-meta-label">Est. Lead Time</span>
              <strong>{leadTimeLabel(supplier.lead_days)}</strong>
            </div>
          </div>
        </div>
      ) : (
        <p className="status">No approved supplier available for this product.</p>
      )}
    </section>
  );
}
