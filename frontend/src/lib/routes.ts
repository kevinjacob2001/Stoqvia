export type HomeView = "inventory" | "received" | "accepted" | "in_transit" | "declined" | "transferred";

export const VIEW_PATHS: Record<HomeView, string> = {
  inventory: "/",
  received: "/received",
  accepted: "/accepted",
  in_transit: "/in-transit",
  declined: "/declined",
  transferred: "/transfer",
};

export function pathToView(pathname: string): HomeView {
  const path = pathname.replace(/\/+$/, "") || "/";
  switch (path) {
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

export function readRoute(): { view: HomeView; transferId: string | null } {
  const view = pathToView(window.location.pathname);
  const transferId = new URLSearchParams(window.location.search).get("id");
  return { view, transferId };
}

export function writeRoute(view: HomeView, transferId: string | null = null, replace = false): void {
  const path = VIEW_PATHS[view];
  const next = transferId ? `${path}?id=${encodeURIComponent(transferId)}` : path;
  if (`${window.location.pathname}${window.location.search}` === next) {
    return;
  }
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
}
