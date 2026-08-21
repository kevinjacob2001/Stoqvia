import type { MeResponse } from "../types.ts";

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

type StoreNavProps = {
  session: MeResponse;
  view: HomeView;
  receivedCount: number;
  acceptedCount: number;
  inTransitCount: number;
  declinedCount: number;
  outgoingCount: number;
  onChangeView: (view: HomeView) => void;
};

export default function StoreNav({
  session,
  view,
  receivedCount,
  acceptedCount,
  inTransitCount,
  declinedCount,
  outgoingCount,
  onChangeView,
}: StoreNavProps) {
  return (
    <aside className="panel sidebar">
      <div className="sidebar-store">
        <strong>{session.store_name}</strong>
        <small>{session.username}</small>
      </div>
      <nav className="sidebar-nav">
        <button
          className={view === "inventory" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("inventory")}
        >
          Inventory
        </button>
        <button
          className={view === "received" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("received")}
        >
          Received
          <span>{receivedCount}</span>
        </button>
        <button
          className={view === "accepted" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("accepted")}
        >
          Accepted
          <span>{acceptedCount}</span>
        </button>
        <button
          className={view === "in_transit" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("in_transit")}
        >
          In transit
          <span>{inTransitCount}</span>
        </button>
        <button
          className={view === "declined" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("declined")}
        >
          Declined
          <span>{declinedCount}</span>
        </button>
        <button
          className={view === "transferred" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("transferred")}
        >
          Transferred
          <span>{outgoingCount}</span>
        </button>
      </nav>
    </aside>
  );
}
