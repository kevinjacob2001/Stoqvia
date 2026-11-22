import "./CopilotSearch.css";
import { useEffect, useState } from "react";
import { askCopilot } from "../../../api.ts";
import { Button, RiskBadge } from "../../../components/ui/index.ts";
import type {
  CopilotDonorHit,
  CopilotProductHit,
  CopilotResponse,
  RiskLevel,
} from "../../../types.ts";

type CopilotSearchProps = {
  productId?: string | null;
  onSelectProduct: (productId: string) => void;
};

function asProductRows(data: Record<string, unknown> | null): CopilotProductHit[] {
  const products = data?.products;
  if (!Array.isArray(products)) return [];
  return products.filter(
    (row): row is CopilotProductHit =>
      typeof row === "object" &&
      row != null &&
      typeof (row as CopilotProductHit).product_id === "string",
  );
}

function asDonorRows(data: Record<string, unknown> | null): CopilotDonorHit[] {
  const donors = data?.donors;
  if (!Array.isArray(donors)) return [];
  return donors.filter(
    (row): row is CopilotDonorHit =>
      typeof row === "object" &&
      row != null &&
      typeof (row as CopilotDonorHit).store_id === "string",
  );
}

export default function CopilotSearch({ productId = null, onSelectProduct }: CopilotSearchProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function submit() {
    const message = query.trim();
    if (!message || busy) return;

    setBusy(true);
    setError(null);
    setOpen(true);
    setResult(null);

    try {
      const response = await askCopilot(message, productId);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copilot request failed");
    } finally {
      setBusy(false);
    }
  }

  const products = result?.intent === "SEARCH_PRODUCTS" ? asProductRows(result.data) : [];
  const donors = result?.intent === "RECOMMEND_DONORS" ? asDonorRows(result.data) : [];
  const donorProductId =
    result?.intent === "RECOMMEND_DONORS" && typeof result.data?.product_id === "string"
      ? result.data.product_id
      : null;

  return (
    <>
      <form
        className="copilot-search"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="copilot-search__field">
          <span className="copilot-search__label">Ask Stoqvia AI</span>
          <input
            type="search"
            value={query}
            placeholder='e.g. "high risk power tools" or "who can donate for this product"'
            disabled={busy}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button type="submit" variant="primary" disabled={busy || !query.trim()}>
          {busy ? "Asking…" : "Ask"}
        </Button>
      </form>

      {open ? (
        <div
          className="copilot-backdrop"
          role="presentation"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <section
            className="copilot-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="copilot-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="copilot-modal__header">
              <div>
                <h2 id="copilot-modal-title">Stoqvia Copilot</h2>
                <p className="copilot-modal__query">“{query.trim()}”</p>
              </div>
              <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                Close
              </Button>
            </header>

            {busy ? <p className="copilot-modal__status">Thinking…</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {!busy && result ? (
              <>
                <p className="copilot-modal__message">{result.message}</p>

                {products.length > 0 ? (
                  <div className="table-wrap copilot-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Risk</th>
                          <th>Usable</th>
                          <th>Shortage</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((row) => (
                          <tr key={row.product_id}>
                            <td>
                              <strong>{row.product_name}</strong>
                              <div className="copilot-row-sub">{row.sku}</div>
                            </td>
                            <td>{row.category ?? "—"}</td>
                            <td>
                              <RiskBadge risk={row.risk as RiskLevel} />
                            </td>
                            <td>{row.usable_stock}</td>
                            <td>{row.predicted_shortage_qty}</td>
                            <td>
                              <Button
                                variant="primary"
                                onClick={() => {
                                  setOpen(false);
                                  onSelectProduct(row.product_id);
                                }}
                              >
                                Request
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {donors.length > 0 ? (
                  <div className="table-wrap copilot-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Store</th>
                          <th>Band</th>
                          <th>Distance</th>
                          <th>Lead</th>
                          <th>Safe surplus</th>
                          <th>Recommended</th>
                        </tr>
                      </thead>
                      <tbody>
                        {donors.map((row) => (
                          <tr key={row.store_id}>
                            <td>
                              <strong>{row.store_name}</strong>
                            </td>
                            <td>{row.band}</td>
                            <td>{row.distance_km} km</td>
                            <td>{row.lead_days}d</td>
                            <td>{row.safe_surplus}</td>
                            <td>{row.recommended_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {donorProductId ? (
                      <div className="copilot-modal__footer">
                        <Button
                          variant="primary"
                          onClick={() => {
                            setOpen(false);
                            onSelectProduct(donorProductId);
                          }}
                        >
                          Create request
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!busy &&
                result.status === "SUCCESS" &&
                products.length === 0 &&
                donors.length === 0 ? (
                  <p className="status">No matching rows.</p>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
