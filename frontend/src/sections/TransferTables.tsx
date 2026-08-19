import type { ReactNode } from "react";
import type { HomeView } from "./StoreNav.tsx";
import type {
  IncomingTransfer,
  OutgoingTransfer,
  RespondAction,
  TransferDetail,
  TransferEvent,
} from "../types.ts";

type TransferTablesProps = {
  mode: HomeView;
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
  myStoreId: string;
  responding: string | null;
  dispatching: string | null;
  onRespond: (transferId: string, action: RespondAction) => void;
  onDispatch: (transferId: string) => void;
  onOpenTransfer: (transferId: string) => void;
  selectedTransferId: string | null;
  transferDetail: TransferDetail | null;
  loadingTransferDetail: boolean;
  onCloseTransferDetail: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CHECKING: "Reviewing stock",
  PASSED: "Passed over",
  OPEN: "Open",
  FULFILLED: "Accepted, awaiting dispatch",
  IN_TRANSIT: "In transit",
  COMPLETED: "Completed",
  REQUESTED: "Request created",
  DISPATCHED: "Dispatched",
  CLEAR_CHECK: "Stock review cleared",
  CHECK_STOCK: "Stock review started",
  ALL_DECLINED: "All invited stores declined",
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
                {i > 0 && <div style={{ flex: 1, height: 3, background: stageReached(STAGES[i - 1]) && done ? "#1f6feb" : "#d9e1ea" }} />}
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
              <span style={{ fontSize: "0.72rem", color: done ? "#102033" : "#8a9aaa", marginTop: 4 }}>{stage}</span>
              <span style={{ fontSize: "0.68rem", color: "#8a9aaa" }}>{fmt(times[stage])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: TransferEvent[] }) {
  if (!events.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: "0.78rem", color: "#5b6b7c", fontWeight: 600 }}>Transfer activity</p>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: "0.78rem", color: "#5b6b7c", marginBottom: 2 }}>
          <span style={{ minWidth: 150 }}>{fmt(ev.at)}</span>
          <span style={{ fontWeight: 500, color: "#102033" }}>{ev.actor}</span>
          <span>{label(ev.action)}</span>
        </div>
      ))}
    </div>
  );
}

function DetailButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ghost-button" type="button" onClick={onClick}>
      View details
    </button>
  );
}

function DetailPage({
  detail,
  loading,
  onClose,
}: {
  detail: TransferDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Transfer details</h2>
          {detail ? (
            <>
              <div style={{ color: "#5b6b7c", fontSize: "0.84rem" }}>Transfer ID: {detail.transfer_id}</div>
              <div style={{ marginTop: 6 }}>
                <strong>{detail.product_name}</strong> <small style={{ color: "#5b6b7c" }}>{detail.sku}</small>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#5b6b7c", marginTop: 4 }}>
                Requested by {detail.requester_store_name} · {detail.qty} units · {label(detail.status)}
              </div>
              {detail.my_status ? (
                <div style={{ fontSize: "0.85rem", color: "#5b6b7c", marginTop: 2 }}>
                  Your status: {label(detail.my_status)}
                </div>
              ) : null}
              {detail.accepted_store_name ? (
                <div style={{ fontSize: "0.85rem", color: "#5b6b7c", marginTop: 2 }}>
                  Accepted by {detail.accepted_store_name}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Back
        </button>
      </div>
      {loading ? <p className="status">Loading transfer details…</p> : null}
      {detail ? (
        <>
          <ProgressBar
            status={detail.status}
            createdAt={detail.created_at}
            acceptedAt={detail.accepted_at}
            dispatchedAt={detail.dispatched_at}
            completedAt={detail.completed_at}
          />

          <div style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>
              Status details
            </p>

            {detail.status === "OPEN" ? (
              <p style={{ margin: 0, color: "#5b6b7c", fontSize: "0.85rem" }}>
                Awaiting store responses. You can review the invited stores below and respond in the <strong>Received</strong> tab.
              </p>
            ) : null}

            {detail.status === "FULFILLED" ? (
              <p style={{ margin: 0, color: "#5b6b7c", fontSize: "0.85rem" }}>
                Accepted by <strong>{detail.accepted_store_name ?? "a store"}</strong>. Dispatch is pending.
              </p>
            ) : null}

            {detail.status === "IN_TRANSIT" ? (
              <p style={{ margin: 0, color: "#5b6b7c", fontSize: "0.85rem" }}>
                In transit{detail.lead_days != null ? (
                  <>
                    {" "}
                    — auto-completes in <strong>{detail.lead_days}</strong> day{detail.lead_days !== 1 ? "s" : ""}.
                  </>
                ) : null}
              </p>
            ) : null}

            {detail.status === "COMPLETED" ? (
              <p style={{ margin: 0, color: "#5b6b7c", fontSize: "0.85rem" }}>
                Completed. This transfer has reached the final stage.
              </p>
            ) : null}

            {detail.status === "DECLINED" ? (
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: "0 0 8px", color: "#b42318", fontSize: "0.85rem", fontWeight: 600 }}>
                  Declined — no store will fulfil this request.
                </p>
                <button
                  className="ghost-button"
                  type="button"
                  disabled
                  title="Supplier contact is not enabled for declined requests yet"
                >
                  Contact supplier
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>Invited stores</p>
            {detail.invited.map((inv) => (
              <div key={inv.store_id} style={{ fontSize: "0.84rem", color: "#5b6b7c", marginBottom: 3 }}>
                <span style={{ color: "#102033", fontWeight: 500 }}>{inv.store_name}</span> — {label(inv.status)}
              </div>
            ))}
          </div>
          <EventTimeline events={detail.events} />
        </>
      ) : null}
    </section>
  );
}

function ReceivedTable({
  incoming,
  responding,
  onRespond,
  onOpenTransfer,
}: {
  incoming: IncomingTransfer[];
  responding: string | null;
  onRespond: (id: string, action: RespondAction) => void;
  onOpenTransfer: (id: string) => void;
}) {
  const active = incoming.filter((r) => ["PENDING", "CHECKING"].includes(r.my_status));
  const resolved = incoming.filter((r) => ["DECLINED", "PASSED", "ACCEPTED"].includes(r.my_status));

  return (
    <section className="panel">
      <h2>Received</h2>
      {active.length === 0 && resolved.length === 0 ? <p className="status">No received requests.</p> : null}
      {active.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Product</th>
              <th className="num">Qty</th>
              <th>Also invited</th>
              <th>My status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.map((row) => (
              <tr key={row.transfer_id}>
                <td>{row.requester_store_name}</td>
                <td>
                  {row.product_name}
                  <small>{row.sku}</small>
                  <small style={{ display: "block", color: "#8a9aaa" }}>ID {row.transfer_id}</small>
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
                  <span style={{ color: row.my_status === "CHECKING" ? "#b54708" : undefined, fontWeight: row.my_status === "CHECKING" ? 600 : undefined }}>
                    {label(row.my_status)}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <ActionButtons
                      status={row.my_status}
                      busy={responding === row.transfer_id}
                      onRespond={(action) => onRespond(row.transfer_id, action)}
                    />
                    <DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {resolved.length > 0 && (
        <>
          <p style={{ margin: "16px 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>Previous requests</p>
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>Product</th>
                <th className="num">Qty</th>
                <th>My status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((row) => (
                <tr key={row.transfer_id}>
                  <td>{row.requester_store_name}</td>
                  <td>
                    {row.product_name}
                    <small>{row.sku}</small>
                    <small style={{ display: "block", color: "#8a9aaa" }}>ID {row.transfer_id}</small>
                  </td>
                  <td className="num">{row.qty}</td>
                  <td style={{ color: row.my_status === "DECLINED" ? "#b42318" : "#5b6b7c" }}>{label(row.my_status)}</td>
                  <td>
                    <DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />
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

function AcceptedTable({
  incoming,
  dispatching,
  onDispatch,
  onOpenTransfer,
}: {
  incoming: IncomingTransfer[];
  dispatching: string | null;
  onDispatch: (id: string) => void;
  onOpenTransfer: (id: string) => void;
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
        <TransferCard
          key={row.transfer_id}
          title={row.product_name}
          sku={row.sku}
          subtitle={`Requested by ${row.requester_store_name} · ${row.qty} units`}
          transferId={row.transfer_id}
          status={row.status}
          createdAt={row.created_at}
          acceptedAt={row.accepted_at}
          dispatchedAt={row.dispatched_at}
          completedAt={row.completed_at}
          events={row.events}
          footer={row.lead_days != null ? `Auto-completes ${row.lead_days} day${row.lead_days !== 1 ? "s" : ""} after dispatch` : undefined}
          actions={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {row.status === "FULFILLED" ? (
                <button className="retry-button" type="button" disabled={dispatching === row.transfer_id} onClick={() => onDispatch(row.transfer_id)}>
                  {dispatching === row.transfer_id ? "Dispatching…" : "Confirm dispatched"}
                </button>
              ) : null}
              <DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />
            </div>
          }
        />
      ))}
    </section>
  );
}

function InTransitTable({
  outgoing,
  incoming,
  onOpenTransfer,
}: {
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
  onOpenTransfer: (id: string) => void;
}) {
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
        <TransferCard
          key={`out-${row.transfer_id}`}
          title={row.product_name}
          sku={row.sku}
          subtitle={`Sent by ${row.accepted_store_name ?? "—"} · ${row.qty} units · arriving in ${row.lead_days ?? "?"} day${row.lead_days !== 1 ? "s" : ""}`}
          transferId={row.transfer_id}
          status={row.status}
          createdAt={row.created_at}
          acceptedAt={row.accepted_at}
          dispatchedAt={row.dispatched_at}
          completedAt={row.completed_at}
          events={row.events}
          actions={<DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />}
        />
      ))}
      {inInTransit.map((row) => (
        <TransferCard
          key={`in-${row.transfer_id}`}
          title={row.product_name}
          sku={row.sku}
          subtitle={`Sending to ${row.requester_store_name} · ${row.qty} units`}
          transferId={row.transfer_id}
          status={row.status}
          createdAt={row.created_at}
          acceptedAt={row.accepted_at}
          dispatchedAt={row.dispatched_at}
          completedAt={row.completed_at}
          events={row.events}
          actions={<DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />}
        />
      ))}
    </section>
  );
}

function DeclinedTable({
  outgoing,
  onOpenTransfer,
}: {
  outgoing: OutgoingTransfer[];
  onOpenTransfer: (id: string) => void;
}) {
  const declined = outgoing.filter((row) => row.status === "DECLINED");
  if (declined.length === 0) {
    return (
      <section className="panel">
        <h2>Declined requests</h2>
        <p className="status">No declined requests.</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Declined requests</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Qty</th>
            <th>Invited stores</th>
            <th>Next action</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {declined.map((row) => (
            <tr key={row.transfer_id}>
              <td>
                {row.product_name}
                <small>{row.sku}</small>
                <small style={{ display: "block", color: "#8a9aaa" }}>ID {row.transfer_id}</small>
              </td>
              <td className="num">{row.qty}</td>
              <td>
                {row.invited.map((inv) => (
                  <span key={inv.store_id} style={{ display: "block" }}>
                    {inv.store_name}
                    <small style={{ color: "#5b6b7c" }}> — {label(inv.status)}</small>
                  </span>
                ))}
              </td>
              <td>
                <button className="ghost-button" type="button" disabled title="Supplier contact is not enabled yet">
                  Contact supplier
                </button>
              </td>
              <td>
                <DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TransferredTable({
  outgoing,
  onOpenTransfer,
}: {
  outgoing: OutgoingTransfer[];
  onOpenTransfer: (id: string) => void;
}) {
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
        <TransferCard
          key={row.transfer_id}
          title={row.product_name}
          sku={row.sku}
          subtitle={`${row.qty} units · ${label(row.status)}`}
          transferId={row.transfer_id}
          status={row.status}
          createdAt={row.created_at}
          acceptedAt={row.accepted_at}
          dispatchedAt={row.dispatched_at}
          completedAt={row.completed_at}
          events={row.events}
          invited={row.invited}
          actions={<DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />}
        />
      ))}
    </section>
  );
}

function TransferCard({
  title,
  sku,
  subtitle,
  transferId,
  status,
  createdAt,
  acceptedAt,
  dispatchedAt,
  completedAt,
  events,
  invited,
  actions,
  footer,
}: {
  title: string;
  sku: string;
  subtitle: string;
  transferId: string;
  status: string;
  createdAt: string | null;
  acceptedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  events: TransferEvent[];
  invited?: Array<{ store_id: string; store_name: string; status: string }>;
  actions?: ReactNode;
  footer?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <strong>{title}</strong> <small style={{ color: "#5b6b7c" }}>{sku}</small>
          <div style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>{subtitle}</div>
          <div style={{ fontSize: "0.78rem", color: "#8a9aaa", marginTop: 2 }}>ID {transferId}</div>
        </div>
        {actions}
      </div>
      <ProgressBar
        status={status}
        createdAt={createdAt}
        acceptedAt={acceptedAt}
        dispatchedAt={dispatchedAt}
        completedAt={completedAt}
      />
      {invited ? (
        <div style={{ marginTop: 6 }}>
          {invited.map((inv) => (
            <span key={inv.store_id} style={{ display: "block", fontSize: "0.82rem", color: "#5b6b7c" }}>
              {inv.store_name} — {label(inv.status)}
            </span>
          ))}
        </div>
      ) : null}
      {footer ? <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#5b6b7c" }}>{footer}</p> : null}
      <EventTimeline events={events} />
    </div>
  );
}

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
      <>
        <button className="retry-button" type="button" disabled={busy} onClick={() => onRespond("ACCEPT")}>
          Accept
        </button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("CLEAR_CHECK")}>
          Clear review
        </button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("DECLINE")}>
          Decline
        </button>
      </>
    );
  }
  return (
    <>
      <button className="retry-button" type="button" disabled={busy} onClick={() => onRespond("ACCEPT")}>
        Accept
      </button>
      <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("CHECK_STOCK")}>
        Review stock
      </button>
      <button className="ghost-button" type="button" disabled={busy} onClick={() => onRespond("DECLINE")}>
        Decline
      </button>
    </>
  );
}

export default function TransferTables({
  mode,
  outgoing,
  incoming,
  myStoreId: _myStoreId,
  responding,
  dispatching,
  onRespond,
  onDispatch,
  onOpenTransfer,
  selectedTransferId,
  transferDetail,
  loadingTransferDetail,
  onCloseTransferDetail,
}: TransferTablesProps) {
  if (selectedTransferId) {
    return <DetailPage detail={transferDetail} loading={loadingTransferDetail} onClose={onCloseTransferDetail} />;
  }
  if (mode === "received") {
    return (
      <ReceivedTable
        incoming={incoming}
        responding={responding}
        onRespond={onRespond}
        onOpenTransfer={onOpenTransfer}
      />
    );
  }
  if (mode === "accepted") {
    return (
      <AcceptedTable
        incoming={incoming}
        dispatching={dispatching}
        onDispatch={onDispatch}
        onOpenTransfer={onOpenTransfer}
      />
    );
  }
  if (mode === "in_transit") {
    return <InTransitTable outgoing={outgoing} incoming={incoming} onOpenTransfer={onOpenTransfer} />;
  }
  if (mode === "declined") {
    return <DeclinedTable outgoing={outgoing} onOpenTransfer={onOpenTransfer} />;
  }
  return <TransferredTable outgoing={outgoing} onOpenTransfer={onOpenTransfer} />;
}
