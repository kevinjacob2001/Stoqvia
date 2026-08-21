import { useState } from "react";
import { Button, ConfirmModal } from "../../components/ui/index.ts";
import type { IncomingTransfer, OutgoingTransfer } from "../../types.ts";
import FulfillmentCard from "./FulfillmentCard.tsx";
import "./TransferUi.css";

type StoreTransfersListProps = {
  incoming: IncomingTransfer[];
  dispatching: string | null;
  onDispatch: (transferId: string) => void;
  onOpenTransfer: (transferId: string) => void;
};

export default function StoreTransfersList({
  incoming,
  dispatching,
  onDispatch,
  onOpenTransfer,
}: StoreTransfersListProps) {
  const accepted = incoming.filter((row) => row.my_status === "ACCEPTED");
  const [pendingDispatchId, setPendingDispatchId] = useState<string | null>(null);
  const pendingRow = accepted.find((row) => row.transfer_id === pendingDispatchId) ?? null;

  if (accepted.length === 0) {
    return <p className="fl-empty td-card">No accepted requests yet.</p>;
  }

  return (
    <div className="fl-list">
      {accepted.map((row) => {
        const status = row.my_allocation?.status ?? row.status;
        const acceptedQty = row.my_accepted_qty ?? row.qty;
        const note =
          row.remaining_qty > 0
            ? `Other stores still need to cover ${row.remaining_qty} more units.`
            : row.delivery_lead_days != null
              ? `Auto-completes ${row.delivery_lead_days} day${row.delivery_lead_days === 1 ? "" : "s"} after dispatch.`
              : row.lead_days != null
                ? `Auto-completes ${row.lead_days} day${row.lead_days === 1 ? "" : "s"} after dispatch.`
                : undefined;

        return (
          <FulfillmentCard
            key={row.transfer_id}
            productName={row.product_name}
            sku={row.sku}
            status={status}
            summary={`Requested by ${row.requester_store_name}. You accepted ${acceptedQty} of ${row.qty} units.`}
            metrics={[
              { label: "Accepted", value: `${acceptedQty} units` },
              { label: "Still need", value: `${row.remaining_qty} units`, warn: row.remaining_qty > 0 },
              { label: "Requester", value: row.requester_store_name },
              {
                label: "Distance",
                value:
                  row.requester_distance_km != null ? `${row.requester_distance_km.toFixed(1)} km` : "—",
              },
            ]}
            transferId={row.transfer_id}
            createdAt={row.created_at}
            acceptedAt={row.my_allocation?.accepted_at ?? row.accepted_at}
            dispatchedAt={row.my_allocation?.dispatched_at ?? row.dispatched_at}
            completedAt={row.my_allocation?.completed_at ?? row.completed_at}
            events={row.events}
            note={note}
            actions={
              <>
                {row.my_allocation?.status === "FULFILLED" ? (
                  <Button
                    variant="primary"
                    disabled={dispatching === row.transfer_id}
                    onClick={() => setPendingDispatchId(row.transfer_id)}
                  >
                    {dispatching === row.transfer_id ? "Dispatching…" : "Confirm dispatched"}
                  </Button>
                ) : null}
                <Button onClick={() => onOpenTransfer(row.transfer_id)}>View details</Button>
              </>
            }
          />
        );
      })}

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
    </div>
  );
}

type InTransitListProps = {
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
  onOpenTransfer: (transferId: string) => void;
};

export function InTransitList({ outgoing, incoming, onOpenTransfer }: InTransitListProps) {
  const inbound = outgoing.filter((row) => row.status === "IN_TRANSIT");
  const outbound = incoming.filter((row) => row.status === "IN_TRANSIT");

  if (inbound.length === 0 && outbound.length === 0) {
    return <p className="fl-empty td-card">No transfers currently in transit.</p>;
  }

  return (
    <div className="fl-list">
      {inbound.length > 0 ? <p className="fl-group-label">Incoming to your store</p> : null}
      {inbound.map((row) => (
        <FulfillmentCard
          key={`in-${row.transfer_id}`}
          productName={row.product_name}
          sku={row.sku}
          status={row.status}
          summary={`Sent by ${row.accepted_store_name ?? "—"}. ${row.qty} units on the way.`}
          metrics={[
            { label: "Quantity", value: `${row.qty} units` },
            { label: "Still need", value: `${row.remaining_qty} units`, warn: row.remaining_qty > 0 },
            { label: "Sent by", value: row.accepted_store_name ?? "—" },
            {
              label: "ETA",
              value:
                row.lead_days != null
                  ? `${row.lead_days} day${row.lead_days === 1 ? "" : "s"}`
                  : "—",
            },
          ]}
          transferId={row.transfer_id}
          createdAt={row.created_at}
          acceptedAt={row.accepted_at}
          dispatchedAt={row.dispatched_at}
          completedAt={row.completed_at}
          events={row.events}
          note={
            row.lead_days != null
              ? `Auto-completes in about ${row.lead_days} day${row.lead_days === 1 ? "" : "s"}.`
              : undefined
          }
          actions={<Button onClick={() => onOpenTransfer(row.transfer_id)}>View details</Button>}
        />
      ))}

      {outbound.length > 0 ? <p className="fl-group-label">Outgoing from your store</p> : null}
      {outbound.map((row) => (
        <FulfillmentCard
          key={`out-${row.transfer_id}`}
          productName={row.product_name}
          sku={row.sku}
          status={row.status}
          summary={`Sending to ${row.requester_store_name}. ${row.qty} units in transit.`}
          metrics={[
            { label: "Quantity", value: `${row.my_accepted_qty ?? row.qty} units` },
            { label: "Destination", value: row.requester_store_name },
            {
              label: "Distance",
              value:
                row.requester_distance_km != null ? `${row.requester_distance_km.toFixed(1)} km` : "—",
            },
            {
              label: "Lead time",
              value:
                row.delivery_lead_days != null
                  ? `${row.delivery_lead_days} day${row.delivery_lead_days === 1 ? "" : "s"}`
                  : row.lead_days != null
                    ? `${row.lead_days} day${row.lead_days === 1 ? "" : "s"}`
                    : "—",
            },
          ]}
          transferId={row.transfer_id}
          createdAt={row.created_at}
          acceptedAt={row.accepted_at}
          dispatchedAt={row.dispatched_at}
          completedAt={row.completed_at}
          events={row.events}
          actions={<Button onClick={() => onOpenTransfer(row.transfer_id)}>View details</Button>}
        />
      ))}
    </div>
  );
}
