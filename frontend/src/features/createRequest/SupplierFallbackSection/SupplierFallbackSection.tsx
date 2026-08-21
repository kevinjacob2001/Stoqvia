import { SurfaceCard } from "../../../components/ui/index.ts";
import type { SupplierOption } from "../../../types.ts";
import { leadTimeLabel, pluralize } from "../requestHelpers.ts";

type SupplierFallbackSectionProps = {
  supplier: SupplierOption | null;
  supplierRemainder: number;
  selectedStoreCount: number;
};

export default function SupplierFallbackSection({
  supplier,
  supplierRemainder,
  selectedStoreCount,
}: SupplierFallbackSectionProps) {
  const coverageNote =
    selectedStoreCount === 0
      ? " Select at least one store to estimate leftover after network surplus."
      : supplierRemainder > 0
        ? ` Right now about ${pluralize(supplierRemainder, "unit")} would remain after selected store surplus.`
        : selectedStoreCount === 1
          ? " The selected store currently has enough surplus to cover this request."
          : " Selected stores currently have enough surplus to cover this request.";

  return (
    <SurfaceCard>
      <div className="cr-section-head">
        <span className="cr-step">3</span>
        <div>
          <h2>Supplier Fallback</h2>
          <p className="cr-help">
            After invited {selectedStoreCount === 1 ? "store responds" : "stores respond"}, any leftover need
            escalates to this supplier automatically.
            {coverageNote}
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
                {selectedStoreCount === 0
                  ? " · Select stores to estimate leftover"
                  : supplierRemainder > 0
                    ? ` · About ${pluralize(supplierRemainder, "unit")} if ${
                        selectedStoreCount === 1 ? "the store cannot" : "stores cannot"
                      } cover`
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
    </SurfaceCard>
  );
}
