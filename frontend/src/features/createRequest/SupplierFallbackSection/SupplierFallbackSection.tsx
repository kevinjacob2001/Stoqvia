import type { SupplierOption } from "../../../types.ts";
import { leadTimeLabel } from "../requestHelpers.ts";

type SupplierFallbackSectionProps = {
  supplier: SupplierOption | null;
  supplierRemainder: number;
};

export default function SupplierFallbackSection({
  supplier,
  supplierRemainder,
}: SupplierFallbackSectionProps) {
  return (
    <section className="cr-card">
      <div className="cr-section-head">
        <span className="cr-step">3</span>
        <div>
          <h2>Supplier Fallback</h2>
          <p className="cr-help">
            After invited stores respond, any leftover need escalates to this supplier automatically.
            {supplierRemainder > 0
              ? ` Right now about ${supplierRemainder} units would remain after selected store surplus.`
              : " Selected stores currently have enough surplus to cover this request."}
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
                Preferred
                {supplierRemainder > 0
                  ? ` · About ${supplierRemainder} units if stores cannot cover`
                  : " · No leftover expected from current surplus"}
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
