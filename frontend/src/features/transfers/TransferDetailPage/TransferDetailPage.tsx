import "../TransferUi.css";
import {
  Avatar,
  Button,
  MetricGrid,
  PageHeader,
  ProductThumb,
  SurfaceCard,
} from "../../../components/ui/index.ts";
import { formatDateTime } from "../../../lib/datetime.ts";
import { VIEW_TITLES, type HomeView } from "../../../lib/routes.ts";
import { transferLabel } from "../../../lib/transferLabels.ts";
import type { TransferDetail } from "../../../types.ts";
import {
  TransferActivityList,
  TransferExpandSection,
  TransferProgress,
  TransferStatusBadge,
  TransferStatusPill,
} from "../TransferShared.tsx";
import { transferStatusSummary } from "../transferUi.ts";

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

function fulfilledOtherLabel(count: number): string {
  if (count === 0) return "None yet";
  return `${count} store${count === 1 ? "" : "s"}`;
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
          <SurfaceCard className="td-hero">
            <div className="td-hero-main">
              <ProductThumb name={detail.product_name} sku={detail.sku} size="lg" />
              <div>
                <div className="td-hero-title-row">
                  <h2>{detail.product_name}</h2>
                  <TransferStatusBadge status={detail.status} />
                </div>
                <p className="td-hero-meta">SKU {detail.sku}</p>
                <p className="td-hero-summary">{transferStatusSummary(detail)}</p>
              </div>
            </div>

            <MetricGrid
              variant="tiles"
              items={[
                { label: "Requested", value: `${detail.qty} units` },
                {
                  label: "Still need",
                  value: `${detail.remaining_qty} units`,
                  warn: detail.remaining_qty > 0,
                },
                { label: "Requester", value: detail.requester_store_name },
                ...(detail.is_requester
                  ? [{ label: "Accepted by", value: detail.accepted_store_name ?? "—" }]
                  : [
                      {
                        label: "Other stores fulfilled",
                        value: fulfilledOtherLabel(detail.fulfilled_other_store_count ?? 0),
                      },
                    ]),
                ...(detail.my_status
                  ? [{ label: "Your status", value: transferLabel(detail.my_status) }]
                  : []),
                ...(detail.lead_days != null
                  ? [
                      {
                        label: "Lead time",
                        value: `${detail.lead_days} day${detail.lead_days === 1 ? "" : "s"}`,
                      },
                    ]
                  : []),
              ]}
            />
          </SurfaceCard>

          <SurfaceCard title="Progress" description="Where this transfer sits in the fulfillment path.">
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
          </SurfaceCard>

          {detail.is_requester ? (
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
                      <TransferStatusPill status={invite.status} />
                    </li>
                  ))}
                </ul>
              )}
            </TransferExpandSection>
          ) : null}

          <TransferExpandSection
            title={detail.is_requester ? "Fulfilments" : "Your fulfilment"}
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
                        {alloc.store_name ?? (alloc.source === "supplier" ? "Supplier" : "Your store")}
                      </strong>
                      <small>
                        {alloc.qty} units · {alloc.source}
                        {alloc.lead_days != null ? ` · ${alloc.lead_days} day lead` : ""}
                      </small>
                    </div>
                    <TransferStatusPill status={alloc.status} />
                  </li>
                ))}
              </ul>
            )}
          </TransferExpandSection>

          {detail.purchase_order && detail.is_requester ? (
            <TransferExpandSection
              title="Purchase order"
              summary={`${detail.purchase_order.supplier_name} · ${detail.purchase_order.qty} units`}
              defaultOpen
            >
              <MetricGrid
                variant="tiles"
                items={[
                  { label: "PO ID", value: detail.purchase_order.po_id },
                  { label: "Supplier", value: detail.purchase_order.supplier_name },
                  { label: "Quantity", value: `${detail.purchase_order.qty} units` },
                  { label: "Status", value: detail.purchase_order.status },
                  {
                    label: "Expected",
                    value: formatDateTime(detail.purchase_order.expected_date),
                  },
                ]}
              />
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
