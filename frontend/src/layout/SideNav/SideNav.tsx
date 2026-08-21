import "./SideNav.css";
import type { ReactNode } from "react";
import { Icon, ICON_PATHS } from "../../components/ui/index.ts";
import type { HomeView } from "../../lib/routes.ts";
import type { MeResponse } from "../../types.ts";

export type NavCounts = {
  receivedCount: number;
  acceptedCount: number;
  inTransitCount: number;
  declinedCount: number;
  outgoingCount: number;
  alertCount: number;
};

type SideNavProps = {
  session: MeResponse;
  view: HomeView;
  counts: NavCounts;
  onChangeView: (view: HomeView) => void;
  onLogout: () => void;
};

type NavLink = {
  view: HomeView;
  label: string;
  count?: number;
};

function NavGroup({
  open,
  label,
  icon,
  active,
  onClick,
  children,
}: {
  open: boolean;
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`side-group${open ? " open" : ""}`}>
      <button type="button" className={active ? "side-item active-parent" : "side-item"} onClick={onClick}>
        <Icon path={icon} />
        {label}
      </button>
      <div className="side-sub">{children}</div>
    </div>
  );
}

function SubLink({ item, current, onChangeView }: { item: NavLink; current: HomeView; onChangeView: (v: HomeView) => void }) {
  return (
    <button
      type="button"
      className={current === item.view ? "side-sub-item active" : "side-sub-item"}
      onClick={() => onChangeView(item.view)}
    >
      {item.label}
      {item.count != null ? <span className="side-count">{item.count}</span> : null}
    </button>
  );
}

export default function SideNav({ session, view, counts, onChangeView, onLogout }: SideNavProps) {
  const requestsOpen =
    view === "requests" ||
    view === "received" ||
    view === "transferred" ||
    view === "declined" ||
    view === "create_request";
  const fulfillOpen = view === "accepted" || view === "in_transit";

  const requestLinks: NavLink[] = [
    { view: "received", label: "Received", count: counts.receivedCount },
    { view: "transferred", label: "Sent", count: counts.outgoingCount },
    { view: "declined", label: "Declined", count: counts.declinedCount },
  ];
  const fulfillLinks: NavLink[] = [
    { view: "accepted", label: "Store Transfers", count: counts.acceptedCount },
    { view: "in_transit", label: "In Transit", count: counts.inTransitCount },
  ];

  return (
    <aside className="side-nav">
      <div className="side-brand">
        <span className="side-logo">STOQVIA</span>
        <small>Inter-store transfer made easy!</small>
      </div>

      <nav className="side-menu">
        <button
          type="button"
          className={view === "inventory" ? "side-item active" : "side-item"}
          onClick={() => onChangeView("inventory")}
        >
          <Icon path={ICON_PATHS.products} />
          Products
        </button>

        <NavGroup
          open={requestsOpen}
          label="Requests"
          icon={ICON_PATHS.requests}
          active={requestsOpen}
          onClick={() => onChangeView("requests")}
        >
          {requestLinks.map((item) => (
            <SubLink key={item.view} item={item} current={view} onChangeView={onChangeView} />
          ))}
        </NavGroup>

        <NavGroup
          open={fulfillOpen}
          label="Fulfillments"
          icon={ICON_PATHS.fulfill}
          active={fulfillOpen}
          onClick={() => onChangeView("accepted")}
        >
          {fulfillLinks.map((item) => (
            <SubLink key={item.view} item={item} current={view} onChangeView={onChangeView} />
          ))}
        </NavGroup>

        <button type="button" className="side-item" disabled title="Coming soon">
          <Icon path={ICON_PATHS.alerts} />
          Alerts
          {counts.alertCount > 0 ? <span className="side-badge">{counts.alertCount}</span> : null}
        </button>
      </nav>

      <div className="side-footer">
        <div className="side-store-chip">
          <strong>{session.store_name}</strong>
          <small>Signed in as {session.username}</small>
        </div>
        <button type="button" className="side-logout" onClick={onLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
