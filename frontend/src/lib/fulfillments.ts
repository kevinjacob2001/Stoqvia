import type { OutgoingTransfer } from "../types.ts";

export type ActiveFulfillment = {
  transferId: string;
  status: string;
  qty: number;
};

const ACTIVE_STATUSES = new Set(["OPEN", "FULFILLED", "IN_TRANSIT"]);

export function buildActiveFulfillments(outgoing: OutgoingTransfer[]): Record<string, ActiveFulfillment> {
  const byProduct: Record<string, ActiveFulfillment> = {};
  for (const row of outgoing) {
    if (!ACTIVE_STATUSES.has(row.status)) continue;
    const existing = byProduct[row.product_id];
    if (!existing || row.status === "IN_TRANSIT" || (existing.status !== "IN_TRANSIT" && row.status === "FULFILLED")) {
      byProduct[row.product_id] = {
        transferId: row.transfer_id,
        status: row.status,
        qty: row.qty,
      };
    }
  }
  return byProduct;
}

export function fulfillmentStatusLabel(status: string): string {
  if (status === "IN_TRANSIT") return "Shipment in progress";
  if (status === "FULFILLED") return "Accepted — awaiting dispatch";
  return "Request pending";
}
