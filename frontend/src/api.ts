import type { StoreInventoryResponse, StoreSummary } from "./types.ts";

const API_BASE = "/api/v1";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function fetchStores(): Promise<StoreSummary[]> {
  return getJson<StoreSummary[]>("/stores");
}

export function fetchStoreInventory(storeId: string): Promise<StoreInventoryResponse> {
  return getJson<StoreInventoryResponse>(`/stores/${storeId}/inventory`);
}
