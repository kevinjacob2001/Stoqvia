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
