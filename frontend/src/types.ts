export type InventoryItem = {
  product_id: string;
  sku: string;
  product_name: string;
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
  requested_qty: number;
  nearby_groups: RadiusGroup[];
  supplier: SupplierOption | null;
};

export type InviteStatus = {
  store_id: string;
  store_name: string;
  status: string;
};

export type OutgoingTransfer = {
  transfer_id: string;
  sku: string;
  product_name: string;
  qty: number;
  status: string;
  invited: InviteStatus[];
};

export type IncomingTransfer = {
  transfer_id: string;
  sku: string;
  product_name: string;
  qty: number;
  requester_store_name: string;
  status: string;
};

export type MyTransfersResponse = {
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
};
