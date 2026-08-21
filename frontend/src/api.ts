import { getToken } from "./auth.ts";
import type {
  IncomingTransfer,
  LoginResponse,
  MeResponse,
  MyTransfersResponse,
  OutgoingTransfer,
  RequestOptionsResponse,
  RespondAction,
  StoreForecastsResponse,
  StoreInventoryResponse,
  TransferDetail,
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
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) {
        message = body.detail;
      }
    } catch {
      // Keep status text when body is not JSON.
    }
    throw new Error(message);
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

export function fetchMyTransfers(): Promise<MyTransfersResponse> {
  return requestJson<MyTransfersResponse>("/transfers");
}

export function createTransfer(
  productId: string,
  donorStoreIds: string[],
  qty?: number,
): Promise<OutgoingTransfer> {
  return requestJson<OutgoingTransfer>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      donor_store_ids: donorStoreIds,
      ...(qty != null ? { qty } : {}),
    }),
  });
}

export function respondToTransfer(
  transferId: string,
  action: RespondAction,
  qty?: number,
): Promise<IncomingTransfer> {
  const body: { action: RespondAction; qty?: number } = { action };
  if (qty != null) body.qty = qty;
  return requestJson<IncomingTransfer>(`/transfers/${transferId}/respond`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function dispatchTransfer(transferId: string): Promise<OutgoingTransfer> {
  return requestJson<OutgoingTransfer>(`/transfers/${transferId}/dispatch`, {
    method: "POST",
  });
}

export function fetchTransferDetail(transferId: string): Promise<TransferDetail> {
  return requestJson<TransferDetail>(`/transfers/${transferId}`);
}
