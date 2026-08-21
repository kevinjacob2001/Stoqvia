import { useState } from "react";
import { Button, Modal, Tabs } from "../components/ui/index.ts";
import type { RequestOptionsResponse } from "../types.ts";

type RequestOptionsModalProps = {
  options: RequestOptionsResponse;
  sending: boolean;
  sendError: string | null;
  onClose: () => void;
  onSend: (storeIds: string[]) => void;
};

type OptionsTab = "stores" | "supplier";

const OPTIONS_TABS: ReadonlyArray<{ key: OptionsTab; label: string }> = [
  { key: "stores", label: "Nearby stores" },
  { key: "supplier", label: "Supplier" },
];

export default function RequestOptionsModal({
  options,
  sending,
  sendError,
  onClose,
  onSend,
}: RequestOptionsModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<OptionsTab>("stores");

  function toggle(storeId: string) {
    setSelected((current) =>
      current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId],
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="request-options-title">
      <header className="modal-head">
        <div>
          <h2 id="request-options-title">{options.product_name}</h2>
          <p>
            {options.sku} · Need {options.requested_qty}
          </p>
        </div>
        <Button variant="icon" onClick={onClose} aria-label="Close">
          ×
        </Button>
      </header>

      <Tabs items={OPTIONS_TABS} value={tab} onChange={setTab} className="segmented" tabClassName="" />

      {tab === "stores" ? (
        <div className="modal-body">
          {options.nearby_groups.length === 0 ? (
            <p className="status">No store can safely supply this product.</p>
          ) : (
            options.nearby_groups.map((group) => (
              <div key={group.band} className="donor-group">
                <p className="band-label">{group.label}</p>
                {group.stores.map((store) => (
                  <label key={store.store_id} className="donor-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(store.store_id)}
                      onChange={() => toggle(store.store_id)}
                    />
                    <span className="donor-copy">
                      <strong>{store.store_name}</strong>
                      <small>
                        {store.distance_km} km · ~{store.lead_days} day
                        {store.lead_days !== 1 ? "s" : ""} transit · Surplus {store.safe_surplus}
                      </small>
                    </span>
                    <span className="num donor-qty">{store.recommended_qty}</span>
                  </label>
                ))}
              </div>
            ))
          )}
          {sendError ? <p className="error">{sendError}</p> : null}
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={selected.length === 0 || sending}
              onClick={() => onSend(selected)}
            >
              {sending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="modal-body">
          {options.supplier ? (
            <dl className="supplier-meta">
              <div>
                <dt>Supplier</dt>
                <dd>{options.supplier.name}</dd>
              </div>
              <div>
                <dt>Lead time</dt>
                <dd>{options.supplier.lead_days} days</dd>
              </div>
              <div>
                <dt>Order qty</dt>
                <dd>{options.supplier.recommended_qty}</dd>
              </div>
            </dl>
          ) : (
            <p className="status">No approved supplier.</p>
          )}
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
