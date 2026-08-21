import type { IncomingTransfer, OutgoingTransfer } from "../types.ts";

const ACTIONABLE = new Set(["PENDING", "CHECKING"]);

export function isActionableInvite(status: string): boolean {
  return ACTIONABLE.has(status);
}

export function waitingReceivedCount(incoming: IncomingTransfer[]): number {
  return incoming.filter((row) => isActionableInvite(row.my_status)).length;
}

export function transferNavStats(incoming: IncomingTransfer[], outgoing: OutgoingTransfer[]) {
  return {
    receivedCount: waitingReceivedCount(incoming),
    acceptedCount: incoming.filter((row) => row.my_status === "ACCEPTED").length,
    inTransitCount:
      outgoing.filter((row) => row.status === "IN_TRANSIT").length +
      incoming.filter((row) => row.status === "IN_TRANSIT" && row.my_status === "ACCEPTED").length,
    declinedCount: outgoing.filter((row) => row.status === "DECLINED").length,
    outgoingCount: outgoing.length,
  };
}
