import type { ReactNode } from "react";
import type { HomeView } from "../lib/routes.ts";
import type { MeResponse } from "../types.ts";
import SideNav, { type NavCounts } from "./SideNav.tsx";

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
      <div className="main-stage">{children}</div>
    </div>
  );
}
