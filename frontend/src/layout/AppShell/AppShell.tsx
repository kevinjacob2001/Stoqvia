import "./AppShell.css";
import type { ReactNode } from "react";
import { SiteFooter } from "../../components/ui/index.ts";
import type { HomeView } from "../../lib/routes.ts";
import type { MeResponse } from "../../types.ts";
import SideNav, { type NavCounts } from "../SideNav/index.ts";

type AppShellProps = {
  session: MeResponse;
  view: HomeView;
  counts: NavCounts;
  onChangeView: (view: HomeView) => void;
  onLogout: () => void;
  children: ReactNode;
};

export default function AppShell({ session, view, counts, onChangeView, onLogout, children }: AppShellProps) {
  return (
    <div className="app-frame">
      <SideNav
        session={session}
        view={view}
        counts={counts}
        onChangeView={onChangeView}
        onLogout={onLogout}
      />
      <div className="main-stage">
        <div className="main-stage__content">{children}</div>
        <SiteFooter />
      </div>
    </div>
  );
}
