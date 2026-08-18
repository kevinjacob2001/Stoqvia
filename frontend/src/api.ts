import { getToken } from "./auth.ts";
import type {
  LoginResponse,
  MeResponse,
  RequestOptionsResponse,
  StoreForecastsResponse,
  StoreInventoryResponse,
} from "./types.ts";

const API_BASE = "/api/v1";

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function fetchMe(): Promise<MeResponse> {
  return requestJson<MeResponse>("/auth/me");
}

export function fetchStoreInventory(storeId: string): Promise<StoreInventoryResponse> {
  return requestJson<StoreInventoryResponse>(`/stores/${storeId}/inventory`);
}

export function fetchStoreForecasts(storeId: string): Promise<StoreForecastsResponse> {
  return requestJson<StoreForecastsResponse>(`/stores/${storeId}/forecasts`);
}

export function fetchRequestOptions(productId: string): Promise<RequestOptionsResponse> {
  return requestJson<RequestOptionsResponse>(`/me/products/${productId}/request-options`);
}
