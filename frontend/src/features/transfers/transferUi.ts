import type { StatusTone } from "../../components/ui/index.ts";
import { transferLabel } from "../../lib/transferLabels.ts";
import type { TransferDetail } from "../../types.ts";

export const TRANSFER_STAGES = ["Requested", "Accepted", "Dispatched", "Received"] as const;
export type TransferStage = (typeof TRANSFER_STAGES)[number];

export function transferStatusTone(status: string): StatusTone {
  if (status === "DECLINED" || status === "ALL_DECLINED") return "danger";
  if (status === "COMPLETED" || status === "ACCEPTED" || status === "RECEIVED") return "ok";
  if (status === "IN_TRANSIT" || status === "DISPATCHED") return "purple";
  if (status === "FULFILLED" || status === "CHECKING") return "info";
  if (status === "OPEN" || status === "PENDING") return "warn";
  return "muted";
}

export function transferStatusSummary(detail: Pick<TransferDetail, "status" | "accepted_store_name" | "lead_days">): string {
  switch (detail.status) {
    case "OPEN":
      return "Awaiting store responses. Invited stores can accept, decline, or review stock.";
    case "FULFILLED":
      return `Accepted by ${detail.accepted_store_name ?? "a store"}. Waiting for dispatch.`;
    case "IN_TRANSIT":
      return detail.lead_days != null
        ? `Shipment is on the way. Auto-completes in ${detail.lead_days} day${detail.lead_days === 1 ? "" : "s"}.`
        : "Shipment is on the way to the requesting store.";
    case "COMPLETED":
      return "Stock has arrived at the requesting store.";
    case "DECLINED":
      return "No store fulfilled this request, and no approved supplier was available.";
    default:
      return transferLabel(detail.status);
  }
}

export function stageReached(
  stage: TransferStage,
  status: string,
  acceptedAt: string | null,
  dispatchedAt: string | null,
): boolean {
  if (stage === "Requested") return true;
  if (stage === "Accepted") {
    return Boolean(acceptedAt) || ["FULFILLED", "IN_TRANSIT", "COMPLETED"].includes(status);
  }
  if (stage === "Dispatched") {
    return Boolean(dispatchedAt) || ["IN_TRANSIT", "COMPLETED"].includes(status);
  }
  if (stage === "Received") return status === "COMPLETED";
  return false;
}
