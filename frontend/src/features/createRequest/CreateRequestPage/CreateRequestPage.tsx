import "./CreateRequestPage.css";
import { useEffect, useMemo, useState } from "react";
import { Button, ConfirmModal, PageHeader } from "../../../components/ui/index.ts";
import type { InventoryItem, RequestOptionsResponse } from "../../../types.ts";
import DonorStoresSection from "../DonorStoresSection/index.ts";
import { flattenDonors } from "../requestHelpers.ts";
import RequestProductSection from "../RequestProductSection/index.ts";
import RequestSummaryPanel from "../RequestSummaryPanel/index.ts";
import SupplierFallbackSection from "../SupplierFallbackSection/index.ts";

export type CreateRequestPageProps = {
  options: RequestOptionsResponse;
  inventoryItem?: InventoryItem;
  sending: boolean;
  sendError: string | null;
  onCancel: () => void;
  onBroadcast: (storeIds: string[]) => void;
};

export default function CreateRequestPage({
  options,
  inventoryItem,
  sending,
  sendError,
  onCancel,
  onBroadcast,
}: CreateRequestPageProps) {
  const stores = useMemo(() => flattenDonors(options.nearby_groups), [options.nearby_groups]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qty, setQty] = useState(options.requested_qty);
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);

  useEffect(() => {
    setSelectedIds(stores.map((store) => store.store_id));
    setQty(options.requested_qty);
  }, [options.product_id, options.requested_qty, stores]);

  const selectedStores = stores.filter((store) => selectedIds.includes(store.store_id));
  const storeCount = selectedIds.length;

  function toggle(storeId: string) {
    setSelectedIds((current) =>
      current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId],
    );
  }

  return (
    <div className="create-request-page">
      <nav className="cr-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="cr-link" onClick={onCancel}>
          Products
        </button>
        <span aria-hidden="true"> / </span>
        <span>Create / Send Request</span>
      </nav>
      <PageHeader
        title="Create / Send Request"
        subtitle="Broadcast this request to selected stores in your network."
      />

      <div className="cr-layout">
        <div className="cr-main">
          <RequestProductSection
            options={options}
            inventoryItem={inventoryItem}
            qty={qty}
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
          <SupplierFallbackSection supplier={options.supplier} />

          {sendError ? <p className="error">{sendError}</p> : null}

          <div className="cr-action-bar">
            <Button variant="ghost" onClick={onCancel} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="cr-broadcast"
              disabled={storeCount === 0 || sending}
              onClick={() => setConfirmBroadcast(true)}
            >
              {sending
                ? "Broadcasting…"
                : `Broadcast Request to ${storeCount} Store${storeCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>

        <RequestSummaryPanel
          options={options}
          qty={qty}
          selectedStores={selectedStores}
          supplier={options.supplier}
        />
      </div>

      <ConfirmModal
        open={confirmBroadcast}
        title="Broadcast this request?"
        message={
          <p>
            Send a request for <strong>{options.product_name}</strong> ({qty} units) to{" "}
            <strong>
              {storeCount} store{storeCount === 1 ? "" : "s"}
            </strong>
            . Invited stores can accept, decline, or review stock.
          </p>
        }
        confirmLabel={`Broadcast to ${storeCount} store${storeCount === 1 ? "" : "s"}`}
        busy={sending}
        onCancel={() => setConfirmBroadcast(false)}
        onConfirm={() => {
          onBroadcast(selectedIds);
          setConfirmBroadcast(false);
        }}
      />
    </div>
  );
}
