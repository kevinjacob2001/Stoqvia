import type { IncomingTransfer, OutgoingTransfer } from "../../types.ts";
import { dayCountLabel, formatDateTime } from "../../lib/datetime.ts";
import { TABLE_PAGE_SIZE } from "../../lib/pagination.ts";

export const REQUESTS_PAGE_SIZE = TABLE_PAGE_SIZE;

export type StatusTone = "need" | "info" | "ok" | "muted" | "transit" | "closed";

export type StatusMessage = {
  title: string;
  detail?: string;
  tone: StatusTone;
};

function transitDetail(leadDays: number | null): string | undefined {
  return leadDays != null ? `Transit — ${dayCountLabel(leadDays)}` : undefined;
}

export function receivedStatus(row: IncomingTransfer): StatusMessage {
  switch (row.my_status) {
    case "PENDING":
      return { title: "Needs your response", tone: "need" };
    case "CHECKING":
      return { title: "You are reviewing stock", tone: "info" };
    case "ACCEPTED":
      return { title: "You accepted — dispatch on Accepted", tone: "ok" };
    case "DECLINED":
      return { title: "You declined", tone: "closed" };
    case "PASSED":
      return { title: "Passed over — covered by others", tone: "muted" };
    default:
      return { title: row.my_status, tone: "muted" };
  }
}

export function sentStatus(row: OutgoingTransfer): StatusMessage {
  switch (row.status) {
    case "OPEN":
      return { title: "Waiting for invited stores to respond", tone: "need" };
    case "FULFILLED":
      return { title: "Accepted — awaiting dispatch", detail: transitDetail(row.lead_days), tone: "info" };
    case "IN_TRANSIT":
      return { title: "In transit to your store", detail: transitDetail(row.lead_days), tone: "transit" };
    case "COMPLETED":
      return {
        title: "Stock received at your store",
        detail: row.completed_at ? `Received ${formatDateTime(row.completed_at, false)}` : undefined,
        tone: "ok",
      };
    case "DECLINED":
      return { title: "Closed — no stock allocated", tone: "closed" };
    default:
      return { title: row.status, tone: "muted" };
  }
}
