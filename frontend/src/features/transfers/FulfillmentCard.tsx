import type { ReactNode } from "react";
import { ExpandSection, ProductThumb, SurfaceCard } from "../../components/ui/index.ts";
import type { TransferEvent } from "../../types.ts";
import {
  TransferActivityList,
  TransferMetrics,
  TransferProgress,
  TransferStatusBadge,
  type TransferMetric,
} from "./TransferShared.tsx";

type FulfillmentCardProps = {
  productName: string;
  sku: string;
  status: string;
  summary: string;
  metrics: TransferMetric[];
  transferId: string;
  createdAt: string | null;
  acceptedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  events: TransferEvent[];
  note?: string;
  actions?: ReactNode;
};

export default function FulfillmentCard({
  productName,
  sku,
  status,
  summary,
  metrics,
  transferId,
  createdAt,
  acceptedAt,
  dispatchedAt,
  completedAt,
  events,
  note,
  actions,
}: FulfillmentCardProps) {
  return (
    <SurfaceCard as="article" className="fl-card">
      <div className="fl-card-top">
        <div className="fl-card-main">
          <ProductThumb name={productName} sku={sku} />
          <div>
            <div className="fl-card-title-row">
              <h3>{productName}</h3>
              <TransferStatusBadge status={status} />
            </div>
            <p className="fl-card-meta">SKU {sku}</p>
            <p className="fl-card-summary">{summary}</p>
          </div>
        </div>
        {actions ? <div className="fl-card-actions">{actions}</div> : null}
      </div>

      <TransferMetrics items={metrics} />

      <div className="fl-progress-head">
        <h3>Progress</h3>
        <p>Where this transfer sits in the fulfillment path.</p>
      </div>
      <TransferProgress
        status={status}
        createdAt={createdAt}
        acceptedAt={acceptedAt}
        dispatchedAt={dispatchedAt}
        completedAt={completedAt}
      />

      {note ? <p className="fl-card-note">{note}</p> : null}

      <ExpandSection
        title="Activity"
        summary={`${events.length} event${events.length === 1 ? "" : "s"}`}
        variant="inline"
      >
        <TransferActivityList events={events} />
      </ExpandSection>

      <p className="td-id">Transfer ID · {transferId}</p>
    </SurfaceCard>
  );
}
