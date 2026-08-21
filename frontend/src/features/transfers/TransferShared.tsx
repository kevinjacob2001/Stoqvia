import type { ReactNode } from "react";
import {
  ActivityTimeline,
  ExpandSection,
  MetricGrid,
  ProgressTrack,
  StatusBadge,
  type MetricGridItem,
} from "../../components/ui/index.ts";
import { formatDateTime } from "../../lib/datetime.ts";
import { actorLabel, transferLabel } from "../../lib/transferLabels.ts";
import type { TransferEvent } from "../../types.ts";
import { stageReached, TRANSFER_STAGES, transferStatusTone } from "./transferUi.ts";

export type TransferMetric = MetricGridItem;

export function TransferStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={transferStatusTone(status)}>{transferLabel(status)}</StatusBadge>;
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
  return (
    <ExpandSection title={title} summary={summary} defaultOpen={defaultOpen}>
      {children}
    </ExpandSection>
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
  const times = {
    Requested: createdAt,
    Accepted: acceptedAt,
    Dispatched: dispatchedAt,
    Received: completedAt,
  } as const;
  const currentIndex = TRANSFER_STAGES.reduce(
    (last, stage, index) => (stageReached(stage, status, acceptedAt, dispatchedAt) ? index : last),
    0,
  );

  return (
    <ProgressTrack
      stages={TRANSFER_STAGES.map((stage, index) => {
        const done = stageReached(stage, status, acceptedAt, dispatchedAt);
        return {
          id: stage,
          label: stage,
          time: formatDateTime(times[stage]),
          done,
          current: index === currentIndex && status !== "DECLINED" && status !== "COMPLETED",
        };
      })}
    />
  );
}

export function TransferActivityList({ events }: { events: TransferEvent[] }) {
  return (
    <ActivityTimeline
      items={events.map((event, index) => ({
        id: `${event.at}-${event.action}-${index}`,
        title: transferLabel(event.action),
        subtitle: `${actorLabel(event.actor)} · ${formatDateTime(event.at)}`,
      }))}
    />
  );
}

export function TransferMetrics({ items }: { items: TransferMetric[] }) {
  return <MetricGrid items={items} variant="tiles" />;
}

export function TransferStatusPill({ status }: { status: string }) {
  return (
    <StatusBadge tone={transferStatusTone(status)} size="sm">
      {transferLabel(status)}
    </StatusBadge>
  );
}
