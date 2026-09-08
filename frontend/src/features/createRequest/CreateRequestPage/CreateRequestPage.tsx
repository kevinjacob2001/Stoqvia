import "./CreateRequestPage.css";
import { useEffect, useMemo, useState } from "react";
import { Button, ConfirmModal, PageHeader } from "../../../components/ui/index.ts";
import type { InventoryItem, RequestOptionsResponse } from "../../../types.ts";
import DonorStoresSection from "../DonorStoresSection/index.ts";
import { clampRequestQty, coverageSplit, flattenDonors, pluralize } from "../requestHelpers.ts";
import RequestProductSection from "../RequestProductSection/index.ts";
import RequestSummaryPanel from "../RequestSummaryPanel/index.ts";
import SupplierFallbackSection from "../SupplierFallbackSection/index.ts";

export type CreateRequestPageProps = {
  options: RequestOptionsResponse;
  inventoryItem?: InventoryItem;
  sending: boolean;
  sendError: string | null;
  onCancel: () => void;
  onBroadcast: (storeIds: string[], qty: number, note?: string) => void;
};

export default function CreateRequestPage({
  options,
  inventoryItem,
  sending,
  sendError,
  onCancel,
  onBroadcast,
}: CreateRequestPageProps) {
  const suggestedQty = Math.max(1, options.requested_qty);
  const stores = useMemo(() => flattenDonors(options.nearby_groups), [options.nearby_groups]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qty, setQty] = useState(() => clampRequestQty(options.requested_qty));
  const [note, setNote] = useState("");
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setQty(clampRequestQty(options.requested_qty));
    setNote("");
  }, [options.product_id, options.requested_qty, stores]);

  const selectedStores = stores.filter((store) => selectedIds.includes(store.store_id));
  const storeCount = selectedIds.length;
  const noDonors = stores.length === 0;
  const supplierOnly = noDonors && options.supplier != null;
  const canSubmit = supplierOnly || storeCount > 0;
  const { networkCover, supplierRemainder } = coverageSplit(qty, selectedStores);

  function toggle(storeId: string) {
    setSelectedIds((current) =>
      current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId],
    );
  }

  return (
    <div className="create-request-page">
      <PageHeader
        title="Create Request"
        subtitle={
          supplierOnly
            ? "No stores can safely donate. Request this product from the supplier."
            : "Broadcast this request to selected stores in your network."
        }
        breadcrumbs={[
          { label: "Products", onClick: onCancel },
          { label: "Create Request" },
        ]}
      />

      <div className="cr-layout">
        <div className="cr-main">
          <RequestProductSection
            options={options}
            inventoryItem={inventoryItem}
            qty={qty}
            suggestedQty={suggestedQty}
            onQtyChange={setQty}
          />
          <DonorStoresSection
            stores={stores}
            needQty={qty}
            selectedIds={selectedIds}
            onToggle={toggle}
            onClear={() => setSelectedIds([])}
            onSelectAll={() => setSelectedIds(stores.map((store) => store.store_id))}
          />
          <SupplierFallbackSection
            supplier={options.supplier}
            supplierRemainder={supplierRemainder}
            selectedStoreCount={storeCount}
            supplierOnly={supplierOnly}
          />

          <label className={`cr-note${supplierOnly ? " cr-note--disabled" : ""}`}>
            Message to invited stores (optional)
            <textarea
              rows={3}
              maxLength={500}
              value={supplierOnly ? "" : note}
              disabled={supplierOnly}
              placeholder={
                supplierOnly
                  ? "Notes are not sent to suppliers."
                  : "e.g. Need this for a Saturday docket — 20 units is enough if you cannot cover the full amount."
              }
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {sendError ? <p className="error">{sendError}</p> : null}
          {noDonors && !options.supplier ? (
            <p className="error">No donor stores or approved supplier for this product.</p>
          ) : null}

          <div className="cr-action-bar">
            <Button variant="ghost" onClick={onCancel} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="cr-broadcast"
              disabled={!canSubmit || sending}
              onClick={() => setConfirmBroadcast(true)}
            >
              {sending
                ? supplierOnly
                  ? "Requesting…"
                  : "Broadcasting…"
                : supplierOnly
                  ? "Request Supplier"
                  : `Broadcast Request to ${pluralize(storeCount, "Store")}`}
            </Button>
          </div>
        </div>

        <RequestSummaryPanel
          options={options}
          qty={qty}
          selectedStores={selectedStores}
          supplier={options.supplier}
          supplierOnly={supplierOnly}
        />
      </div>

      <ConfirmModal
        open={confirmBroadcast}
        title={supplierOnly ? "Request from supplier?" : "Broadcast this request?"}
        message={
          supplierOnly ? (
            <p>
              Place a supplier order for <strong>{pluralize(qty, "unit")}</strong> of{" "}
              <strong>{options.product_name}</strong>
              {options.supplier ? (
                <>
                  {" "}
                  via <strong>{options.supplier.name}</strong>
                </>
              ) : null}
              . No stores have safe surplus to invite.
            </p>
          ) : (
            <p>
              Send a request for <strong>{options.product_name}</strong> ({pluralize(qty, "unit")}) to{" "}
              <strong>{pluralize(storeCount, "store")}</strong>.{" "}
              {storeCount === 1 ? "The selected store can" : "Selected stores can"} cover up to{" "}
              <strong>{pluralize(networkCover, "unit")}</strong>
              {supplierRemainder > 0 ? (
                <>
                  ; about <strong>{pluralize(supplierRemainder, "unit")}</strong> may go to supplier if needed
                </>
              ) : null}
              .
            </p>
          )
        }
        confirmLabel={supplierOnly ? "Request supplier" : `Broadcast to ${pluralize(storeCount, "store")}`}
        busy={sending}
        onCancel={() => setConfirmBroadcast(false)}
        onConfirm={() => {
          onBroadcast(supplierOnly ? [] : selectedIds, qty, supplierOnly ? undefined : note.trim() || undefined);
          setConfirmBroadcast(false);
        }}
      />
    </div>
  );
}
