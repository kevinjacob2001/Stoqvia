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
        <h2 id="request-options-title">
          {options.product_name}
          <small>
            {options.sku} · need {options.requested_qty} · {options.risk}
          </small>
        </h2>

        <section className="modal-section">
          <h3>Request nearby stores</h3>
          {options.nearby_groups.length === 0 ? (
            <p className="status">No nearby store can safely spare this product.</p>
          ) : (
            options.nearby_groups.map((group) => (
              <div key={group.band}>
                <p className="band-label">{group.label}</p>
                {group.stores.map((store) => (
                  <label key={store.store_id} className="donor-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(store.store_id)}
                      onChange={() => toggle(store.store_id)}
                    />
                    <span>
                      <strong>{store.store_name}</strong>
                      <small>
                        {store.distance_km} km · surplus {store.safe_surplus} · send{" "}
                        {store.recommended_qty}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            ))
          )}
          <button
            className="retry-button"
            disabled={selected.length === 0 || sending}
            type="button"
            onClick={() => onSend(selected)}
          >
            {sending ? "Sending…" : "Send transfer request"}
          </button>
          {sendError ? <p className="error">{sendError}</p> : null}
          <p className="hint">Only ticked stores receive this request. You cannot take it back.</p>
        </section>

        <section className="modal-section supplier-section">
          <h3>Contact supplier</h3>
          {options.supplier ? (
            <p>
              {options.supplier.name} · {options.supplier.lead_days} day lead · order{" "}
              {options.supplier.recommended_qty} (min {options.supplier.min_order_qty}, available{" "}
              {options.supplier.available_qty})
            </p>
          ) : (
            <p className="status">No approved supplier for this product.</p>
          )}
          <button className="ghost-button" disabled type="button">
            Create purchase order
          </button>
        </section>

        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
