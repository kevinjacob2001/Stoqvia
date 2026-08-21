import { useState, type ReactNode } from "react";
import { ProductThumb } from "../../components/ui/index.ts";
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
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <article className="td-card fl-card">
      <div className="fl-card-top">
        <div className="fl-card-main">
          <ProductThumb name={productName} />
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

      <div className="td-card-head" style={{ marginTop: 14, marginBottom: 10 }}>
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

      <div className="fl-activity-block">
        <button
          type="button"
          className="fl-activity-toggle"
          onClick={() => setActivityOpen((value) => !value)}
          aria-expanded={activityOpen}
        >
          <span>
            Activity · {events.length} event{events.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden="true">{activityOpen ? "−" : "+"}</span>
        </button>
        {activityOpen ? <TransferActivityList events={events} /> : null}
      </div>

      <p className="td-id">Transfer ID · {transferId}</p>
    </article>
  );
}
