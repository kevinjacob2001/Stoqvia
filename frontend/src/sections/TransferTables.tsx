import type { ReactNode } from "react";
import type { HomeView } from "../lib/routes.ts";
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
  onRespond: (transferId: string, action: RespondAction, qty?: number) => void;
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
  COMPLETED: "Received",
  REQUESTED: "Request created",
  DISPATCHED: "Dispatched to requester",
  CLEAR_CHECK: "Stock review cleared",
  CHECK_STOCK: "Stock review started",
  ALL_DECLINED: "All invited stores declined",
  SUPPLIER_ESCALATED: "Escalated to supplier",
  PO_CREATED: "Purchase order created",
  PO_RECEIVED: "Purchase order received",
  RECEIVED: "Stock received at store",
  PARTIAL_ACCEPTED: "Partially accepted",
  REMAINING_UPDATED: "Remaining qty updated for other stores",
};

function label(s: string) {
  return STATUS_LABEL[s] ?? s;
}

function actorLabel(actor: string) {
  if (actor === "system" || actor === "System") return "System";
  if (actor === "supplier" || actor === "Supplier") return "Supplier";
  return actor;
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

const STAGES = ["Requested", "Accepted", "Dispatched", "Received"] as const;

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
    if (stage === "Received") return status === "COMPLETED";
    return false;
  };
  const times: Record<string, string | null> = {
    Requested: createdAt,
    Accepted: acceptedAt,
    Dispatched: dispatchedAt,
    Received: completedAt,
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
          <span style={{ fontWeight: 500, color: "#102033" }}>{actorLabel(ev.actor)}</span>
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
                Requested by {detail.requester_store_name} · {detail.qty} units
                {detail.remaining_qty > 0 ? ` · still need ${detail.remaining_qty}` : ""} · {label(detail.status)}
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
                Received — stock has arrived at the requesting store.
              </p>
            ) : null}

            {detail.status === "DECLINED" ? (
              <p style={{ margin: "8px 0 0", color: "#b42318", fontSize: "0.85rem", fontWeight: 600 }}>
                Declined — no store will fulfil this request, and no approved supplier is available.
              </p>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>Invited stores</p>
            {detail.invited.map((inv) => (
              <div key={inv.store_id} style={{ fontSize: "0.84rem", color: "#5b6b7c", marginBottom: 3 }}>
                <span style={{ color: "#102033", fontWeight: 500 }}>{inv.store_name}</span> — {label(inv.status)}
                {inv.accepted_qty != null ? ` (${inv.accepted_qty} units)` : ""}
              </div>
            ))}
          </div>
          {detail.allocations.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>Fulfilments</p>
              {detail.allocations.map((alloc) => (
                <div key={alloc.allocation_id} style={{ fontSize: "0.84rem", color: "#5b6b7c", marginBottom: 3 }}>
                  <span style={{ color: "#102033", fontWeight: 500 }}>
                    {alloc.store_name ?? (alloc.source === "supplier" ? "Supplier" : "Store")}
                  </span>
                  {` — ${alloc.qty} units · ${label(alloc.status)}`}
                </div>
              ))}
            </div>
          ) : null}
          {detail.purchase_order ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#5b6b7c", fontWeight: 600 }}>
                Purchase order
              </p>
              <div style={{ fontSize: "0.85rem", color: "#5b6b7c" }}>
                <div>
                  PO ID: <span style={{ color: "#102033" }}>{detail.purchase_order.po_id}</span>
                </div>
                <div>
                  Supplier: <span style={{ color: "#102033" }}>{detail.purchase_order.supplier_name}</span>
                </div>
                <div>
                  Qty: <span style={{ color: "#102033" }}>{detail.purchase_order.qty}</span>
                </div>
                <div>
                  Status: <span style={{ color: "#102033" }}>{detail.purchase_order.status}</span>
                </div>
                <div>
                  Expected: <span style={{ color: "#102033" }}>{fmt(detail.purchase_order.expected_date)}</span>
                </div>
              </div>
            </div>
          ) : null}
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
  onRespond: (id: string, action: RespondAction, qty?: number) => void;
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
              <th className="num">Need</th>
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
                  {row.remaining_qty < row.qty ? (
                    <small style={{ display: "block", color: "#b54708", fontWeight: 600 }}>
                      Partial progress — still need {row.remaining_qty} of {row.qty}
                    </small>
                  ) : null}
                  {row.delivery_lead_days != null ? (
                    <small style={{ display: "block", color: "#5b6b7c" }}>
                      Your transit to {row.requester_store_name}: ~{row.delivery_lead_days} day
                      {row.delivery_lead_days !== 1 ? "s" : ""}
                    </small>
                  ) : null}
                  {row.max_accept_qty != null ? (
                    <small style={{ display: "block", color: "#5b6b7c" }}>
                      Safe to send up to {row.max_accept_qty} without raising your risk
                      {row.safe_surplus != null ? ` (keeps you LOW; surplus ${row.safe_surplus})` : ""}
                    </small>
                  ) : null}
                </td>
                <td className="num">
                  <strong>{row.remaining_qty}</strong>
                  <small style={{ display: "block", color: "#8a9aaa" }}>of {row.qty}</small>
                </td>
                <td>
                  {row.all_invited.map((inv) => (
                    <span key={inv.store_id} style={{ display: "block" }}>
                      {inv.store_name}
                      <small style={{ color: "#5b6b7c" }}>
                        {" "}
                        — {label(inv.status)}
                        {inv.accepted_qty != null ? ` (${inv.accepted_qty})` : ""}
                      </small>
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
                      remainingQty={row.remaining_qty}
                      maxAcceptQty={row.max_accept_qty ?? 0}
                      safeSurplus={row.safe_surplus ?? 0}
                      busy={responding === row.transfer_id}
                      onRespond={(action, qty) => onRespond(row.transfer_id, action, qty)}
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
                  <td className="num">{row.my_accepted_qty ?? row.qty}</td>
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
  const accepted = incoming.filter((r) => r.my_status === "ACCEPTED");
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
          subtitle={`Requested by ${row.requester_store_name} · you accepted ${row.my_accepted_qty ?? row.qty} of ${row.qty}`}
          transferId={row.transfer_id}
          status={row.my_allocation?.status ?? row.status}
          createdAt={row.created_at}
          acceptedAt={row.my_allocation?.accepted_at ?? row.accepted_at}
          dispatchedAt={row.my_allocation?.dispatched_at ?? row.dispatched_at}
          completedAt={row.my_allocation?.completed_at ?? row.completed_at}
          events={row.events}
          footer={
            row.remaining_qty > 0
              ? `Other stores still need to cover ${row.remaining_qty} more units`
              : row.delivery_lead_days != null
                ? `Auto-completes ${row.delivery_lead_days} day${row.delivery_lead_days !== 1 ? "s" : ""} after dispatch`
                : row.lead_days != null
                  ? `Auto-completes ${row.lead_days} day${row.lead_days !== 1 ? "s" : ""} after dispatch`
                : undefined
          }
          actions={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {row.my_allocation?.status === "FULFILLED" ? (
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
      <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#5b6b7c" }}>
        Requests where all invited stores declined and no supplier could be assigned.
      </p>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Qty</th>
            <th>Invited stores</th>
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
          subtitle={`${row.qty} units · ${row.remaining_qty > 0 ? `${row.remaining_qty} still needed · ` : ""}${label(row.status)}`}
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
  remainingQty,
  maxAcceptQty,
  safeSurplus,
  busy,
  onRespond,
}: {
  status: string;
  remainingQty: number;
  maxAcceptQty: number;
  safeSurplus: number;
  busy: boolean;
  onRespond: (action: RespondAction, qty?: number) => void;
}) {
  function handleAccept() {
    if (maxAcceptQty < 1) {
      window.alert(
        "You have no safe surplus for this product, so you cannot accept this transfer.",
      );
      return;
    }
    const raw = window.prompt(
      `How many units can you safely fulfil? (1–${maxAcceptQty})\n` +
        `Receiver still needs ${remainingQty}. Max that keeps your risk LOW: ${safeSurplus}.`,
      String(maxAcceptQty),
    );
    if (raw == null) return;
    const qty = Number.parseInt(raw, 10);
    if (!Number.isFinite(qty) || qty < 1 || qty > maxAcceptQty) {
      window.alert(
        `Enter a whole number between 1 and ${maxAcceptQty} (capped by need and your safe surplus).`,
      );
      return;
    }
    onRespond("ACCEPT", qty);
  }

  const acceptDisabled = busy || maxAcceptQty < 1;

  if (status === "CHECKING") {
    return (
      <>
        <button className="retry-button" type="button" disabled={acceptDisabled} onClick={handleAccept}>
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
      <button className="retry-button" type="button" disabled={acceptDisabled} onClick={handleAccept}>
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
  if (selectedTransferId && (loadingTransferDetail || transferDetail)) {
    return (
      <DetailPage
        detail={transferDetail}
        loading={loadingTransferDetail}
        onClose={onCloseTransferDetail}
      />
    );
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
