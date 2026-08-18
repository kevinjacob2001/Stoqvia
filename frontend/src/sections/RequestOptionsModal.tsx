import { useState } from "react";
import type { RequestOptionsResponse } from "../types.ts";

type RequestOptionsModalProps = {
  options: RequestOptionsResponse;
  sending: boolean;
  sendError: string | null;
  onClose: () => void;
  onSend: (storeIds: string[]) => void;
};

export default function RequestOptionsModal({
  options,
  sending,
  sendError,
  onClose,
  onSend,
}: RequestOptionsModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<"stores" | "supplier">("stores");

  function toggle(storeId: string) {
    setSelected((current) =>
      current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId],
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="panel modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="request-options-title"
      >
        <header className="modal-head">
          <div>
            <h2 id="request-options-title">{options.product_name}</h2>
            <p>
              {options.sku} · Need {options.requested_qty}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="segmented">
          <button className={tab === "stores" ? "active" : ""} type="button" onClick={() => setTab("stores")}>
            Nearby stores
          </button>
          <button
            className={tab === "supplier" ? "active" : ""}
            type="button"
            onClick={() => setTab("supplier")}
          >
            Supplier
          </button>
        </div>

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
                          {store.distance_km} km · Surplus {store.safe_surplus}
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
              <button className="ghost-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="retry-button"
                disabled={selected.length === 0 || sending}
                type="button"
                onClick={() => onSend(selected)}
              >
                {sending ? "Sending…" : "Send request"}
              </button>
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
              <button className="ghost-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="retry-button" disabled type="button">
                Create PO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
