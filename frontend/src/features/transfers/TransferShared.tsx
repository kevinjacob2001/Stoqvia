import { useState, type ReactNode } from "react";
import { formatDateTime } from "../../lib/datetime.ts";
import { actorLabel, transferLabel } from "../../lib/transferLabels.ts";
import type { TransferEvent } from "../../types.ts";
import {
  stageReached,
  TRANSFER_STAGES,
  transferStatusTone,
  type TransferStage,
} from "./transferUi.ts";

export function TransferStatusBadge({ status }: { status: string }) {
  return <span className={`td-badge tone-${transferStatusTone(status)}`}>{transferLabel(status)}</span>;
}

export function TransferExpandSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`td-section${open ? " open" : ""}`}>
      <button
        type="button"
        className="td-section-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span className="td-chevron" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="td-section-body">{children}</div> : null}
    </section>
  );
}

export function TransferProgress({
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
  const times: Record<TransferStage, string | null> = {
    Requested: createdAt,
    Accepted: acceptedAt,
    Dispatched: dispatchedAt,
    Received: completedAt,
  };
  const currentIndex = TRANSFER_STAGES.reduce(
    (last, stage, index) => (stageReached(stage, status, acceptedAt, dispatchedAt) ? index : last),
    0,
  );

  return (
    <ol className="td-progress">
      {TRANSFER_STAGES.map((stage, index) => {
        const done = stageReached(stage, status, acceptedAt, dispatchedAt);
        const current = index === currentIndex && status !== "DECLINED" && status !== "COMPLETED";
        return (
          <li key={stage} className={`td-progress-step${done ? " done" : ""}${current ? " current" : ""}`}>
            <div className="td-progress-rail">
              <span className="td-progress-dot" />
            </div>
            <div className="td-progress-copy">
              <strong>{stage}</strong>
              <small>{formatDateTime(times[stage])}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TransferActivityList({ events }: { events: TransferEvent[] }) {
  if (events.length === 0) {
    return <p className="td-empty">No activity recorded yet.</p>;
  }
  return (
    <ul className="td-activity">
      {events.map((event, index) => (
        <li key={`${event.at}-${event.action}-${index}`}>
          <div className="td-activity-dot" aria-hidden="true" />
          <div>
            <strong>{transferLabel(event.action)}</strong>
            <small>
              {actorLabel(event.actor)} · {formatDateTime(event.at)}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

export type TransferMetric = {
  label: string;
  value: string;
  warn?: boolean;
};

export function TransferMetrics({ items }: { items: TransferMetric[] }) {
  return (
    <dl className="td-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.warn ? "stock-warn" : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
