import type { HomeView } from "./StoreNav.tsx";
import type { IncomingTransfer, OutgoingTransfer, RespondAction, TransferEvent } from "../types.ts";

type TransferTablesProps = {
  mode: HomeView;
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
  myStoreId: string;
  responding: string | null;
  dispatching: string | null;
  onRespond: (transferId: string, action: RespondAction) => void;
  onDispatch: (transferId: string) => void;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CHECKING: "Checking stock",
  PASSED: "Passed",
  OPEN: "Open",
  FULFILLED: "Fulfilled — awaiting dispatch",
  IN_TRANSIT: "In transit",
  COMPLETED: "Completed",
  REQUESTED: "Requested",
  DISPATCHED: "Dispatched",
  CLEAR_CHECK: "Cleared check",
  CHECK_STOCK: "Checked stock",
};

function label(s: string) {
  return STATUS_LABEL[s] ?? s;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
const STAGES = ["Requested", "Accepted", "Dispatched", "Completed"] as const;

function ProgressBar({
  status,
  createdAt,
  acceptedAt,
  dispatchedAt,
  completedAt,
}: {
  status: string;
  createdAt: string | null;
  acceptedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
}) {
  const stageReached = (stage: string) => {
    if (stage === "Requested") return true;
    if (stage === "Accepted") return !!acceptedAt;
    if (stage === "Dispatched") return !!dispatchedAt;
    if (stage === "Completed") return status === "COMPLETED";
    return false;
  };
  const times: Record<string, string | null> = {
    Requested: createdAt,
    Accepted: acceptedAt,
    Dispatched: dispatchedAt,
    Completed: completedAt,
  };

  return (
    <div style={{ margin: "10px 0 6px" }}>
      <div style={{ display: "flex", gap: 0 }}>
        {STAGES.map((stage, i) => {
          const done = stageReached(stage);
          return (
            <div key={stage} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
                {i > 0 && (
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      background: stageReached(STAGES[i - 1]) && done ? "#1f6feb" : "#d9e1ea",
                    }}
                  />
                )}
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: done ? "#1f6feb" : "#d9e1ea",
                    border: "2px solid " + (done ? "#1f6feb" : "#d9e1ea"),
                    flexShrink: 0,
                  }}
                />
                {i < STAGES.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      background: done && stageReached(STAGES[i + 1]) ? "#1f6feb" : "#d9e1ea",
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: "0.72rem", color: done ? "#102033" : "#8a9aaa", marginTop: 4 }}>
                {stage}
              </span>
              <span style={{ fontSize: "0.68rem", color: "#8a9aaa" }}>{fmt(times[stage])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event timeline
// ---------------------------------------------------------------------------
function EventTimeline({ events }: { events: TransferEvent[] }) {
  if (!events.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: "0.78rem", color: "#5b6b7c", fontWeight: 600 }}>
        Event log
      </p>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: "0.78rem", color: "#5b6b7c", marginBottom: 2 }}>
          <span style={{ minWidth: 130 }}>{fmt(ev.at)}</span>
          <span style={{ fontWeight: 500, color: "#102033" }}>{ev.actor}</span>
          <span>{label(ev.action)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Received tab
// ---------------------------------------------------------------------------
function ReceivedTable({
  incoming,
  responding,
  onRespond,
}: {
  incoming: IncomingTransfer[];
  responding: string | null;
  onRespond: (id: string, action: RespondAction) => void;
}) {
  // Received = active invites (PENDING or CHECKING). Declined / Passed shown separately below.
  const active = incoming.filter((r) => ["PENDING", "CHECKING"].includes(r.my_status));
  const resolved = incoming.filter((r) => ["DECLINED", "PASSED", "ACCEPTED"].includes(r.my_status));

  return (
    <section className="panel">
      <h2>Received</h2>
      {active.length === 0 && resolved.length === 0 ? (
        <p className="status">No received requests.</p>
      ) : null}
      {active.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Product</th>
              <th className="num">Qty</th>
              <th>Also asked</th>
              <th>My status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.map((row) => (
              <ActiveIncomingRow
                key={row.transfer_id}
                row={row}
                busy={responding === row.transfer_id}
                onRespond={onRespond}
              />
            ))}
          </tbody>
        </table>
      )}
      {resolved.length > 0 && (
        <>
          <p style={{ margin: "16px 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>
            Previous requests
          </p>
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>Product</th>
                <th className="num">Qty</th>
                <th>My status</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((row) => (
                <tr key={row.transfer_id}>
                  <td>{row.requester_store_name}</td>
                  <td>
                    {row.product_name}
                    <small>{row.sku}</small>
                  </td>
                  <td className="num">{row.qty}</td>
                  <td style={{ color: row.my_status === "DECLINED" ? "#b42318" : "#5b6b7c" }}>
                    {label(row.my_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function ActiveIncomingRow({
  row,
  busy,
  onRespond,
}: {
  row: IncomingTransfer;
  busy: boolean;
  onRespond: (id: string, action: RespondAction) => void;
}) {
  const s = row.my_status;
  return (
    <tr>
      <td>{row.requester_store_name}</td>
      <td>
        {row.product_name}
        <small>{row.sku}</small>
      </td>
      <td className="num">{row.qty}</td>
      <td>
        {row.all_invited.map((inv) => (
          <span key={inv.store_id} style={{ display: "block" }}>
            {inv.store_name}
            <small style={{ color: "#5b6b7c" }}> — {label(inv.status)}</small>
          </span>
        ))}
      </td>
      <td>
        <span
          style={{
            color: s === "CHECKING" ? "#b54708" : undefined,
            fontWeight: s === "CHECKING" ? 600 : undefined,
          }}
        >
          {label(s)}
        </span>
      </td>
      <td>
        <ActionButtons
          status={s}
          busy={busy}
          onRespond={(action) => onRespond(row.transfer_id, action)}
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Accepted tab (donor — dispatches from here)
// ---------------------------------------------------------------------------
function AcceptedTable({
  incoming,
  dispatching,
  onDispatch,
}: {
  incoming: IncomingTransfer[];
  dispatching: string | null;
  onDispatch: (id: string) => void;
}) {
  const accepted = incoming.filter(
    (r) => r.my_status === "ACCEPTED" && ["FULFILLED", "IN_TRANSIT", "COMPLETED"].includes(r.status),
  );
  if (accepted.length === 0) {
    return (
      <section className="panel">
        <h2>Accepted</h2>
        <p className="status">No accepted requests yet.</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Accepted</h2>
      {accepted.map((row) => (
        <div key={row.transfer_id} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong>{row.product_name}</strong>{" "}
              <small style={{ color: "#5b6b7c" }}>{row.sku}</small>
              <div style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>
                Requested by {row.requester_store_name} · {row.qty} units
              </div>
            </div>
            {row.status === "FULFILLED" && (
              <button
                className="retry-button"
                type="button"
                disabled={dispatching === row.transfer_id}
                onClick={() => onDispatch(row.transfer_id)}
              >
                {dispatching === row.transfer_id ? "Dispatching…" : "Confirm dispatched"}
              </button>
            )}
            {row.status !== "FULFILLED" && (
              <span style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>{label(row.status)}</span>
            )}
          </div>
          <ProgressBar
            status={row.status}
            createdAt={row.created_at}
            acceptedAt={row.accepted_at}
            dispatchedAt={row.dispatched_at}
            completedAt={row.completed_at}
          />
          <EventTimeline events={row.events} />
          {row.lead_days != null && (
            <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#5b6b7c" }}>
              Auto-completes {row.lead_days} day{row.lead_days !== 1 ? "s" : ""} after dispatch
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// In Transit tab (all involved stores)
// ---------------------------------------------------------------------------
function InTransitTable({ outgoing, incoming }: { outgoing: OutgoingTransfer[]; incoming: IncomingTransfer[] }) {
  const outInTransit = outgoing.filter((r) => r.status === "IN_TRANSIT");
  const inInTransit = incoming.filter((r) => r.status === "IN_TRANSIT");

  if (outInTransit.length === 0 && inInTransit.length === 0) {
    return (
      <section className="panel">
        <h2>In transit</h2>
        <p className="status">No transfers currently in transit.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>In transit</h2>
      {outInTransit.map((row) => (
        <div key={row.transfer_id} style={{ marginBottom: 20 }}>
          <div>
            <strong>{row.product_name}</strong>{" "}
            <small style={{ color: "#5b6b7c" }}>{row.sku}</small>
            <div style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>
              Sent by {row.accepted_store_name ?? "—"} · {row.qty} units · arriving in{" "}
              {row.lead_days ?? "?"} day{row.lead_days !== 1 ? "s" : ""}
            </div>
          </div>
          <ProgressBar
            status={row.status}
            createdAt={row.created_at}
            acceptedAt={row.accepted_at}
            dispatchedAt={row.dispatched_at}
            completedAt={row.completed_at}
          />
          <EventTimeline events={row.events} />
        </div>
      ))}
      {inInTransit.map((row) => (
        <div key={row.transfer_id} style={{ marginBottom: 20 }}>
          <div>
            <strong>{row.product_name}</strong>{" "}
            <small style={{ color: "#5b6b7c" }}>{row.sku}</small>
            <div style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>
              Sending to {row.requester_store_name} · {row.qty} units
            </div>
          </div>
          <ProgressBar
            status={row.status}
            createdAt={row.created_at}
            acceptedAt={row.accepted_at}
            dispatchedAt={row.dispatched_at}
            completedAt={row.completed_at}
          />
          <EventTimeline events={row.events} />
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Transferred tab (requester's outgoing)
// ---------------------------------------------------------------------------
function TransferredTable({ outgoing }: { outgoing: OutgoingTransfer[] }) {
  if (outgoing.length === 0) {
    return (
      <section className="panel">
        <h2>Transferred</h2>
        <p className="status">No transferred products.</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Transferred</h2>
      {outgoing.map((row) => (
        <div key={row.transfer_id} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <strong>{row.product_name}</strong>{" "}
              <small style={{ color: "#5b6b7c" }}>{row.sku}</small>
              <div style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>
                {row.qty} units · {label(row.status)}
              </div>
            </div>
          </div>
          <ProgressBar
            status={row.status}
            createdAt={row.created_at}
            acceptedAt={row.accepted_at}
            dispatchedAt={row.dispatched_at}
            completedAt={row.completed_at}
          />
          <div style={{ marginTop: 6 }}>
            {row.invited.map((inv) => (
              <span key={inv.store_id} style={{ display: "block", fontSize: "0.82rem", color: "#5b6b7c" }}>
                {inv.store_name} — {label(inv.status)}
              </span>
            ))}
          </div>
          <EventTimeline events={row.events} />
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Action buttons (Received tab)
// ---------------------------------------------------------------------------
function ActionButtons({
  status,
  busy,
  onRespond,
}: {
  status: string;
  busy: boolean;
  onRespond: (action: RespondAction) => void;
}) {
  if (status === "CHECKING") {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="retry-button" type="button" disabled={busy} onClick={() => onRespond("ACCEPT")}>
          Accept
        </button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("CLEAR_CHECK")}>
          Clear check
        </button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("DECLINE")}>
          Decline
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button className="retry-button" type="button" disabled={busy} onClick={() => onRespond("ACCEPT")}>
        Accept
      </button>
      <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("CHECK_STOCK")}>
        Check stock
      </button>
      <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("DECLINE")}>
        Decline
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------
export default function TransferTables({
  mode,
  outgoing,
  incoming,
  myStoreId: _myStoreId,
  responding,
  dispatching,
  onRespond,
  onDispatch,
}: TransferTablesProps) {
  if (mode === "received") {
    return <ReceivedTable incoming={incoming} responding={responding} onRespond={onRespond} />;
  }
  if (mode === "accepted") {
    return <AcceptedTable incoming={incoming} dispatching={dispatching} onDispatch={onDispatch} />;
  }
  if (mode === "in_transit") {
    return <InTransitTable outgoing={outgoing} incoming={incoming} />;
  }
  return <TransferredTable outgoing={outgoing} />;
}
