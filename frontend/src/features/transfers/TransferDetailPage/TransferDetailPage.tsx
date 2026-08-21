import "../TransferUi.css";
import { Avatar, Button, PageHeader, ProductThumb } from "../../../components/ui/index.ts";
import { formatDateTime } from "../../../lib/datetime.ts";
import { VIEW_TITLES, type HomeView } from "../../../lib/routes.ts";
import { transferLabel } from "../../../lib/transferLabels.ts";
import type { TransferDetail } from "../../../types.ts";
import {
  TransferActivityList,
  TransferExpandSection,
  TransferProgress,
  TransferStatusBadge,
} from "../TransferShared.tsx";
import { transferStatusSummary, transferStatusTone } from "../transferUi.ts";

type TransferDetailPageProps = {
  detail: TransferDetail | null;
  loading: boolean;
  view: HomeView;
  onClose: () => void;
  onNavigate?: (view: HomeView) => void;
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

export default function TransferDetailPage({
  detail,
  loading,
  view,
  onClose,
  onNavigate,
}: TransferDetailPageProps) {
  return (
    <div className="transfer-detail-page">
      <PageHeader
        title="Transfer details"
        subtitle={detail ? `${detail.product_name} · ${detail.qty} units` : "Loading transfer…"}
        breadcrumbs={detailBreadcrumbs(view, onClose, onNavigate)}
        meta={<Button onClick={onClose}>Back</Button>}
      />

      {loading && !detail ? <p className="status">Loading transfer details…</p> : null}

      {detail ? (
        <div className="td-layout">
          <section className="td-card td-hero">
            <div className="td-hero-main">
              <ProductThumb name={detail.product_name} size="lg" />
              <div>
                <div className="td-hero-title-row">
                  <h2>{detail.product_name}</h2>
                  <TransferStatusBadge status={detail.status} />
                </div>
                <p className="td-hero-meta">SKU {detail.sku}</p>
                <p className="td-hero-summary">{transferStatusSummary(detail)}</p>
              </div>
            </div>

            <dl className="td-metrics">
              <div>
                <dt>Requested</dt>
                <dd>{detail.qty} units</dd>
              </div>
              <div>
                <dt>Still need</dt>
                <dd className={detail.remaining_qty > 0 ? "stock-warn" : undefined}>
                  {detail.remaining_qty} units
                </dd>
              </div>
              <div>
                <dt>Requester</dt>
                <dd>{detail.requester_store_name}</dd>
              </div>
              <div>
                <dt>Accepted by</dt>
                <dd>{detail.accepted_store_name ?? "—"}</dd>
              </div>
              {detail.my_status ? (
                <div>
                  <dt>Your status</dt>
                  <dd>{transferLabel(detail.my_status)}</dd>
                </div>
              ) : null}
              {detail.lead_days != null ? (
                <div>
                  <dt>Lead time</dt>
                  <dd>
                    {detail.lead_days} day{detail.lead_days === 1 ? "" : "s"}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="td-card">
            <div className="td-card-head">
              <h3>Progress</h3>
              <p>Where this transfer sits in the fulfillment path.</p>
            </div>
            {detail.status === "DECLINED" ? (
              <div className="td-callout danger">{transferStatusSummary(detail)}</div>
            ) : (
              <TransferProgress
                status={detail.status}
                createdAt={detail.created_at}
                acceptedAt={detail.accepted_at}
                dispatchedAt={detail.dispatched_at}
                completedAt={detail.completed_at}
              />
            )}
          </section>

          <TransferExpandSection
            title="Invited stores"
            summary={`${detail.invited.length} store${detail.invited.length === 1 ? "" : "s"} invited`}
            defaultOpen
          >
            {detail.invited.length === 0 ? (
              <p className="td-empty">No invited stores.</p>
            ) : (
              <ul className="td-store-list">
                {detail.invited.map((invite) => (
                  <li key={invite.store_id}>
                    <Avatar name={invite.store_name} title="" />
                    <div>
                      <strong>{invite.store_name}</strong>
                      <small>
                        {invite.accepted_qty != null
                          ? `${invite.accepted_qty} units accepted`
                          : "No units accepted yet"}
                      </small>
                    </div>
                    <span className={`td-pill tone-${transferStatusTone(invite.status)}`}>
                      {transferLabel(invite.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TransferExpandSection>

          <TransferExpandSection
            title="Fulfilments"
            summary={
              detail.allocations.length === 0
                ? "None yet"
                : `${detail.allocations.length} allocation${detail.allocations.length === 1 ? "" : "s"}`
            }
            defaultOpen={detail.allocations.length > 0}
          >
            {detail.allocations.length === 0 ? (
              <p className="td-empty">No fulfilments recorded yet.</p>
            ) : (
              <ul className="td-store-list">
                {detail.allocations.map((alloc) => (
                  <li key={alloc.allocation_id}>
                    <Avatar
                      name={alloc.store_name ?? (alloc.source === "supplier" ? "Supplier" : "Store")}
                      title=""
                    />
                    <div>
                      <strong>
                        {alloc.store_name ?? (alloc.source === "supplier" ? "Supplier" : "Store")}
                      </strong>
                      <small>
                        {alloc.qty} units · {alloc.source}
                        {alloc.lead_days != null ? ` · ${alloc.lead_days} day lead` : ""}
                      </small>
                    </div>
                    <span className={`td-pill tone-${transferStatusTone(alloc.status)}`}>
                      {transferLabel(alloc.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TransferExpandSection>

          {detail.purchase_order ? (
            <TransferExpandSection
              title="Purchase order"
              summary={`${detail.purchase_order.supplier_name} · ${detail.purchase_order.qty} units`}
              defaultOpen
            >
              <dl className="td-po-grid">
                <div>
                  <dt>PO ID</dt>
                  <dd>{detail.purchase_order.po_id}</dd>
                </div>
                <div>
                  <dt>Supplier</dt>
                  <dd>{detail.purchase_order.supplier_name}</dd>
                </div>
                <div>
                  <dt>Quantity</dt>
                  <dd>{detail.purchase_order.qty} units</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{detail.purchase_order.status}</dd>
                </div>
                <div>
                  <dt>Expected</dt>
                  <dd>{formatDateTime(detail.purchase_order.expected_date)}</dd>
                </div>
              </dl>
            </TransferExpandSection>
          ) : null}

          <TransferExpandSection
            title="Activity"
            summary={`${detail.events.length} event${detail.events.length === 1 ? "" : "s"}`}
            defaultOpen={detail.events.length > 0 && detail.events.length <= 8}
          >
            <TransferActivityList events={detail.events} />
          </TransferExpandSection>

          <p className="td-id">Transfer ID · {detail.transfer_id}</p>
        </div>
      ) : null}
    </div>
  );
}
