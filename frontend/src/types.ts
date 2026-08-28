export type InventoryItem = {
  product_id: string;
  sku: string;
  product_name: string;
  image_url?: string | null;
  product_url?: string | null;
  on_hand: number;
  usable_stock: number;
  safety_stock: number;
};

export type StoreInventoryResponse = {
  store_id: string;
  store_name: string;
  items: InventoryItem[];
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ForecastResponse = {
  product_id: string;
  predicted_7d_demand: number;
  predicted_shortage_qty: number;
  risk: RiskLevel;
};

export type StoreForecastsResponse = {
  forecasts: ForecastResponse[];
};

export type LoginResponse = {
  token: string;
  store_id: string;
  store_name: string;
  username: string;
};

export type MeResponse = {
  store_id: string;
  store_name: string;
  username: string;
};

export type DonorOption = {
  store_id: string;
  store_name: string;
  distance_km: number;
  lead_days: number;
  safe_surplus: number;
  recommended_qty: number;
};

export type RadiusGroup = {
  band: string;
  label: string;
  stores: DonorOption[];
};

export type SupplierOption = {
  name: string;
  lead_days: number;
  recommended_qty: number;
};

export type RequestOptionsResponse = {
  product_id: string;
  sku: string;
  product_name: string;
  image_url?: string | null;
  product_url?: string | null;
  requested_qty: number;
  nearby_groups: RadiusGroup[];
  supplier: SupplierOption | null;
};

export type InviteStatus = {
  store_id: string;
  store_name: string;
  status: string;
  accepted_qty?: number | null;
};

export type TransferAllocation = {
  allocation_id: string;
  source: string;
  store_id: string | null;
  store_name: string | null;
  qty: number;
  status: string;
  accepted_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  lead_days: number | null;
  po_id: string | null;
};

export type TransferEvent = {
  at: string;
  actor: string;
  action: string;
};

export type OutgoingTransfer = {
  transfer_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  qty: number;
  remaining_qty: number;
  status: string;
  invited: InviteStatus[];
  allocations: TransferAllocation[];
  created_at: string | null;
  accepted_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  accepted_store_name: string | null;
  lead_days: number | null;
  events: TransferEvent[];
};

export type IncomingTransfer = {
  transfer_id: string;
  sku: string;
  product_name: string;
  qty: number;
  remaining_qty: number;
  requester_store_name: string;
  requester_distance_km: number | null;
  my_status: string;
  my_accepted_qty: number | null;
  my_allocation: TransferAllocation | null;
  delivery_lead_days: number | null;
  max_accept_qty: number | null;
  safe_surplus: number | null;
  fulfilled_other_store_count: number;
  stock_under_review_by_other: boolean;
  allocations: TransferAllocation[];
  status: string;
  created_at: string | null;
  accepted_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  lead_days: number | null;
  events: TransferEvent[];
};

export type MyTransfersResponse = {
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
};

export type TransferPurchaseOrder = {
  po_id: string;
  supplier_name: string;
  qty: number;
  status: string;
  expected_date: string | null;
};

export type TransferDetail = {
  transfer_id: string;
  sku: string;
  product_name: string;
  qty: number;
  remaining_qty: number;
  status: string;
  requester_store_name: string;
  accepted_store_name: string | null;
  my_status: string | null;
  is_requester: boolean;
  fulfilled_other_store_count: number | null;
  invited: InviteStatus[];
  allocations: TransferAllocation[];
  created_at: string | null;
  accepted_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  lead_days: number | null;
  events: TransferEvent[];
  purchase_order: TransferPurchaseOrder | null;
};

export type RespondAction = "ACCEPT" | "DECLINE" | "CHECK_STOCK" | "CLEAR_CHECK";
