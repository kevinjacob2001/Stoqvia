export type StoreSummary = {
  store_id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
};

export type InventoryItem = {
  store_id: string;
  store_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  on_hand: number;
  reserved: number;
  usable_stock: number;
  safety_stock: number;
  updated_at: string;
};

export type StoreInventoryResponse = {
  store_id: string;
  store_name: string;
  region: string;
  item_count: number;
  items: InventoryItem[];
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ForecastResponse = {
  store_id: string;
  product_id: string;
  sku: string;
  current_usable_stock: number;
  predicted_7d_demand: number;
  safety_stock: number;
  projected_available_stock: number;
  predicted_shortage_qty: number;
  risk: RiskLevel;
};

export type StoreForecastsResponse = {
  store_id: string;
  store_name: string;
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
  region: string;
  username: string;
};
