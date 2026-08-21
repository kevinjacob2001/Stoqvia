import type { ReactNode } from "react";
import { useState } from "react";
import { Button, ConfirmModal, PageHeader } from "../../components/ui/index.ts";
import { formatDateTime } from "../../lib/datetime.ts";
import { VIEW_TITLES, type HomeView } from "../../lib/routes.ts";
import { actorLabel, transferLabel } from "../../lib/transferLabels.ts";
import type {
  IncomingTransfer,
  OutgoingTransfer,
  TransferDetail,
  TransferEvent,
} from "../../types.ts";

export type TransferListMode = "accepted" | "in_transit" | "declined";

type TransferTablesProps = {
  mode: TransferListMode;
  view: HomeView;
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
  dispatching: string | null;
  onDispatch: (transferId: string) => void;
  onOpenTransfer: (transferId: string) => void;
  selectedTransferId: string | null;
  transferDetail: TransferDetail | null;
  loadingTransferDetail: boolean;
  onCloseTransferDetail: () => void;
  onNavigate?: (view: HomeView) => void;
};

const MODE_META: Record<
  TransferListMode,
  { title: string; subtitle: string; parent: string; parentView: HomeView }
> = {
  accepted: {
    title: VIEW_TITLES.accepted,
    subtitle: "Accepted requests ready for you to dispatch.",
    parent: "Fulfillments",
    parentView: "accepted",
  },
  in_transit: {
    title: VIEW_TITLES.in_transit,
    subtitle: "Shipments moving between stores.",
    parent: "Fulfillments",
    parentView: "accepted",
  },
  declined: {
    title: VIEW_TITLES.declined,
    subtitle: "Requests that were declined or closed without stock.",
    parent: "Requests",
    parentView: "requests",
  },
};

type Crumb = { label: string; onClick?: () => void };

function detailBreadcrumbs(
  view: HomeView,
  onClose: () => void,
  onNavigate?: (view: HomeView) => void,
): Crumb[] {
  if (view === "accepted" || view === "in_transit") {
    return [
      { label: "Fulfillments", onClick: onNavigate ? () => onNavigate("accepted") : undefined },
      { label: VIEW_TITLES[view], onClick: onClose },
      { label: "Transfer details" },
    ];
  }
  if (view === "declined") {
    return [
      { label: "Requests", onClick: onNavigate ? () => onNavigate("requests") : undefined },
      { label: VIEW_TITLES.declined, onClick: onClose },
      { label: "Transfer details" },
    ];
  }
  const crumbs: Crumb[] = [
    { label: "Requests", onClick: onNavigate ? () => onNavigate("requests") : undefined },
  ];
  if (view === "received" || view === "transferred") {
    crumbs.push({ label: VIEW_TITLES[view], onClick: onClose });
  }
  crumbs.push({ label: "Transfer details" });
  return crumbs;
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
              <span style={{ fontSize: "0.68rem", color: "#8a9aaa" }}>{formatDateTime(times[stage])}</span>
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
          <span style={{ minWidth: 150 }}>{formatDateTime(ev.at)}</span>
          <span style={{ fontWeight: 500, color: "#102033" }}>{actorLabel(ev.actor)}</span>
          <span>{transferLabel(ev.action)}</span>
        </div>
      ))}
    </div>
  );
}

function DetailButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      View details
    </Button>
  );
}

function DetailPage({
  detail,
  loading,
  onClose,
  view,
  onNavigate,
}: {
  detail: TransferDetail | null;
  loading: boolean;
  onClose: () => void;
  view: HomeView;
  onNavigate?: (view: HomeView) => void;
}) {
  return (
    <div>
      <PageHeader
        title="Transfer details"
        subtitle={detail ? `${detail.product_name} · ${detail.qty} units` : "Loading transfer…"}
        breadcrumbs={detailBreadcrumbs(view, onClose, onNavigate)}
        meta={<Button onClick={onClose}>Back</Button>}
      />
      <section className="panel">
        <div>
          {detail ? (
            <>
              <div style={{ color: "#5b6b7c", fontSize: "0.84rem" }}>Transfer ID: {detail.transfer_id}</div>
              <div style={{ marginTop: 6 }}>
                <strong>{detail.product_name}</strong> <small style={{ color: "#5b6b7c" }}>{detail.sku}</small>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#5b6b7c", marginTop: 4 }}>
                Requested by {detail.requester_store_name} · {detail.qty} units
                {detail.remaining_qty > 0 ? ` · still need ${detail.remaining_qty}` : ""} · {transferLabel(detail.status)}
              </div>
              {detail.my_status ? (
                <div style={{ fontSize: "0.85rem", color: "#5b6b7c", marginTop: 2 }}>
                  Your status: {transferLabel(detail.my_status)}
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
                  <span style={{ color: "#102033", fontWeight: 500 }}>{inv.store_name}</span> — {transferLabel(inv.status)}
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
                    {` — ${alloc.qty} units · ${transferLabel(alloc.status)}`}
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
                    Expected: <span style={{ color: "#102033" }}>{formatDateTime(detail.purchase_order.expected_date)}</span>
                  </div>
                </div>
              </div>
            ) : null}
            <EventTimeline events={detail.events} />
          </>
        ) : null}
      </section>
    </div>
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
  const [pendingDispatchId, setPendingDispatchId] = useState<string | null>(null);
  const pendingRow = accepted.find((row) => row.transfer_id === pendingDispatchId) ?? null;

  if (accepted.length === 0) {
    return (
      <section className="panel">
        <p className="status">No accepted requests yet.</p>
      </section>
    );
  }
  return (
    <section className="panel">
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
                <Button
                  variant="primary"
                  disabled={dispatching === row.transfer_id}
                  onClick={() => setPendingDispatchId(row.transfer_id)}
                >
                  {dispatching === row.transfer_id ? "Dispatching…" : "Confirm dispatched"}
                </Button>
              ) : null}
              <DetailButton onClick={() => onOpenTransfer(row.transfer_id)} />
            </div>
          }
        />
      ))}
      <ConfirmModal
        open={pendingRow != null}
        title="Confirm dispatch?"
        message={
          pendingRow ? (
            <p>
              Confirm that <strong>{pendingRow.my_accepted_qty ?? pendingRow.qty}</strong> units of{" "}
              <strong>{pendingRow.product_name}</strong> have left for{" "}
              <strong>{pendingRow.requester_store_name}</strong>.
            </p>
          ) : null
        }
        confirmLabel="Confirm dispatched"
        busy={pendingRow != null && dispatching === pendingRow.transfer_id}
        onCancel={() => setPendingDispatchId(null)}
        onConfirm={() => {
          if (!pendingRow) return;
          onDispatch(pendingRow.transfer_id);
          setPendingDispatchId(null);
        }}
      />
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
        <p className="status">No transfers currently in transit.</p>
      </section>
    );
  }
  return (
    <section className="panel">
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
        <p className="status">No declined requests.</p>
      </section>
    );
  }
  return (
    <section className="panel">
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
                    <small style={{ color: "#5b6b7c" }}> — {transferLabel(inv.status)}</small>
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
      {footer ? <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#5b6b7c" }}>{footer}</p> : null}
      <EventTimeline events={events} />
    </div>
  );
}

export default function TransferTables({
  mode,
  view,
  outgoing,
  incoming,
  dispatching,
  onDispatch,
  onOpenTransfer,
  selectedTransferId,
  transferDetail,
  loadingTransferDetail,
  onCloseTransferDetail,
  onNavigate,
}: TransferTablesProps) {
  const meta = MODE_META[mode];
  const listHeader = (
    <PageHeader
      title={meta.title}
      subtitle={meta.subtitle}
      breadcrumbs={[
        {
          label: meta.parent,
          onClick: onNavigate ? () => onNavigate(meta.parentView) : undefined,
        },
        { label: meta.title },
      ]}
    />
  );

  if (selectedTransferId && (loadingTransferDetail || transferDetail)) {
    return (
      <DetailPage
        detail={transferDetail}
        loading={loadingTransferDetail}
        onClose={onCloseTransferDetail}
        view={view}
        onNavigate={onNavigate}
      />
    );
  }
  if (mode === "accepted") {
    return (
      <>
        {listHeader}
        <AcceptedTable
          incoming={incoming}
          dispatching={dispatching}
          onDispatch={onDispatch}
          onOpenTransfer={onOpenTransfer}
        />
      </>
    );
  }
  if (mode === "in_transit") {
    return (
      <>
        {listHeader}
        <InTransitTable outgoing={outgoing} incoming={incoming} onOpenTransfer={onOpenTransfer} />
      </>
    );
  }
  return (
    <>
      {listHeader}
      <DeclinedTable outgoing={outgoing} onOpenTransfer={onOpenTransfer} />
    </>
  );
}
