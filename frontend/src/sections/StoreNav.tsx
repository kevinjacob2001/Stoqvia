import type { MeResponse } from "../types.ts";

export type HomeView = "inventory" | "received" | "transferred";

type StoreNavProps = {
  session: MeResponse;
  view: HomeView;
  incomingCount: number;
  outgoingCount: number;
  onChangeView: (view: HomeView) => void;
};

export default function StoreNav({
  session,
  view,
  incomingCount,
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
          <span>{incomingCount}</span>
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
