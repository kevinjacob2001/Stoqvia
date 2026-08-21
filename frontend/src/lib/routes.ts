export type HomeView =
  | "inventory"
  | "create_request"
  | "requests"
  | "received"
  | "accepted"
  | "in_transit"
  | "declined"
  | "transferred";

export const VIEW_PATHS: Record<HomeView, string> = {
  inventory: "/",
  create_request: "/request",
  requests: "/requests",
  received: "/received",
  accepted: "/accepted",
  in_transit: "/in-transit",
  declined: "/declined",
  transferred: "/transfer",
};

export function pathToView(pathname: string): HomeView {
  const path = pathname.replace(/\/+$/, "") || "/";
  switch (path) {
    case "/request":
      return "create_request";
    case "/requests":
      return "requests";
    case "/received":
      return "received";
    case "/accepted":
      return "accepted";
    case "/in-transit":
      return "in_transit";
    case "/declined":
      return "declined";
    case "/transfer":
      return "transferred";
    default:
      return "inventory";
  }
}

export type RouteState = {
  view: HomeView;
  transferId: string | null;
  productId: string | null;
};

export function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  return {
    view: pathToView(window.location.pathname),
    transferId: params.get("id"),
    productId: params.get("product"),
  };
}

export function writeRoute(
  view: HomeView,
  opts: { transferId?: string | null; productId?: string | null; replace?: boolean } = {},
): void {
  const path = VIEW_PATHS[view];
  const params = new URLSearchParams();
  if (opts.transferId) params.set("id", opts.transferId);
  if (opts.productId) params.set("product", opts.productId);
  const query = params.toString();
  const next = query ? `${path}?${query}` : path;
  if (`${window.location.pathname}${window.location.search}` === next) {
    return;
  }
  if (opts.replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
}
