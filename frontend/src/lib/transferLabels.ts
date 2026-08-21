const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CHECKING: "Reviewing stock",
  PASSED: "Passed over",
  OPEN: "Open",
  FULFILLED: "Accepted, awaiting dispatch",
  IN_TRANSIT: "In transit",
  COMPLETED: "Received",
  REQUESTED: "Request created",
  DISPATCHED: "Dispatched to requester",
  CLEAR_CHECK: "Stock review cleared",
  CHECK_STOCK: "Stock review started",
  ALL_DECLINED: "All invited stores declined",
  SUPPLIER_ESCALATED: "Escalated to supplier",
  PO_CREATED: "Purchase order created",
  PO_RECEIVED: "Purchase order received",
  RECEIVED: "Stock received at store",
  PARTIAL_ACCEPTED: "Partially accepted",
  REMAINING_UPDATED: "Remaining qty updated for other stores",
};

export function transferLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function actorLabel(actor: string): string {
  if (actor === "system" || actor === "System") return "System";
  if (actor === "supplier" || actor === "Supplier") return "Supplier";
  return actor;
}
