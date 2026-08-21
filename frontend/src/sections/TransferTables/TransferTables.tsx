import { Button, PageHeader } from "../../components/ui/index.ts";
import { VIEW_TITLES, type HomeView } from "../../lib/routes.ts";
import { transferLabel } from "../../lib/transferLabels.ts";
import StoreTransfersList, { InTransitList } from "../../features/transfers/FulfillmentLists.tsx";
import TransferDetailPage from "../../features/transfers/TransferDetailPage/index.ts";
import "../../features/transfers/TransferUi.css";
import type { IncomingTransfer, OutgoingTransfer, TransferDetail } from "../../types.ts";

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

function DeclinedTable({
  outgoing,
  onOpenTransfer,
}: {
  outgoing: OutgoingTransfer[];
  onOpenTransfer: (id: string) => void;
}) {
  const declined = outgoing.filter((row) => row.status === "DECLINED");
  if (declined.length === 0) {
    return <p className="fl-empty td-card">No declined requests.</p>;
  }
  return (
    <section className="td-card">
      <div className="td-card-head">
        <h3>Declined requests</h3>
        <p>All invited stores declined and no supplier could be assigned.</p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
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
                  <strong>{row.product_name}</strong>
                  <small style={{ display: "block", color: "var(--muted)" }}>SKU {row.sku}</small>
                </td>
                <td className="num">{row.qty}</td>
                <td>
                  {row.invited.map((inv) => (
                    <span key={inv.store_id} style={{ display: "block" }}>
                      {inv.store_name}
                      <small style={{ color: "var(--muted)" }}> — {transferLabel(inv.status)}</small>
                    </span>
                  ))}
                </td>
                <td>
                  <Button onClick={() => onOpenTransfer(row.transfer_id)}>View details</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
      <TransferDetailPage
        detail={transferDetail}
        loading={loadingTransferDetail}
        onClose={onCloseTransferDetail}
        view={view}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="fulfillment-list-page">
      {listHeader}
      {mode === "accepted" ? (
        <StoreTransfersList
          incoming={incoming}
          dispatching={dispatching}
          onDispatch={onDispatch}
          onOpenTransfer={onOpenTransfer}
        />
      ) : null}
      {mode === "in_transit" ? (
        <InTransitList outgoing={outgoing} incoming={incoming} onOpenTransfer={onOpenTransfer} />
      ) : null}
      {mode === "declined" ? <DeclinedTable outgoing={outgoing} onOpenTransfer={onOpenTransfer} /> : null}
    </div>
  );
}
