import "./RequestsPage.css";
import { PageHeader } from "../../../components/ui/index.ts";
import { waitingReceivedCount } from "../../../lib/transferCounts.ts";
import { VIEW_TITLES, type HomeView } from "../../../lib/routes.ts";
import type { IncomingTransfer, OutgoingTransfer, RespondAction } from "../../../types.ts";
import ReceivedRequestsTable from "../ReceivedRequestsTable/index.ts";
import SentRequestsTable from "../SentRequestsTable/index.ts";

export type RequestsPageMode = "overview" | "received" | "sent";

type RequestsPageProps = {
  mode: RequestsPageMode;
  incoming: IncomingTransfer[];
  outgoing: OutgoingTransfer[];
  responding: string | null;
  onRespond: (transferId: string, action: RespondAction, qty?: number, message?: string) => void;
  onOpenTransfer: (transferId: string) => void;
  onViewAllReceived?: () => void;
  onViewAllSent?: () => void;
  onNavigate?: (view: HomeView) => void;
};

function pageCopy(
  mode: RequestsPageMode,
  onNavigate?: (view: HomeView) => void,
): { title: string; subtitle: string; crumbs: { label: string; onClick?: () => void }[] } {
  if (mode === "received") {
    return {
      title: VIEW_TITLES.received,
      subtitle: "Incoming stock requests from other stores.",
      crumbs: [
        { label: "Requests", onClick: onNavigate ? () => onNavigate("requests") : undefined },
        { label: VIEW_TITLES.received },
      ],
    };
  }
  if (mode === "sent") {
    return {
      title: VIEW_TITLES.transferred,
      subtitle: "Requests you broadcast to the network.",
      crumbs: [
        { label: "Requests", onClick: onNavigate ? () => onNavigate("requests") : undefined },
        { label: VIEW_TITLES.transferred },
      ],
    };
  }
  return {
    title: VIEW_TITLES.requests,
    subtitle: "Received and sent stock-balance requests.",
    crumbs: [{ label: VIEW_TITLES.requests }],
  };
}

export default function RequestsPage({
  mode,
  incoming,
  outgoing,
  responding,
  onRespond,
  onOpenTransfer,
  onViewAllReceived,
  onViewAllSent,
  onNavigate,
}: RequestsPageProps) {
  const waitingCount = waitingReceivedCount(incoming);
  const copy = pageCopy(mode, onNavigate);

  return (
    <div className="requests-page">
      <PageHeader title={copy.title} subtitle={copy.subtitle} breadcrumbs={copy.crumbs} />

      {waitingCount > 0 ? (
        <div className="req-banner" role="status">
          You have <strong>{waitingCount}</strong> received request{waitingCount === 1 ? "" : "s"} waiting for{" "}
          <strong>Accept</strong>, <strong>Decline</strong>, or <strong>Review</strong>.
        </div>
      ) : null}

      {mode !== "sent" ? (
        <div className="req-section">
          {mode === "overview" && onViewAllReceived ? (
            <button className="link-button req-view-all" type="button" onClick={onViewAllReceived}>
              View all received
            </button>
          ) : null}
          <ReceivedRequestsTable
            incoming={incoming}
            responding={responding}
            onRespond={onRespond}
            onOpenTransfer={onOpenTransfer}
          />
        </div>
      ) : null}

      {mode !== "received" ? (
        <div className="req-section">
          {mode === "overview" && onViewAllSent ? (
            <button className="link-button req-view-all" type="button" onClick={onViewAllSent}>
              View all sent
            </button>
          ) : null}
          <SentRequestsTable outgoing={outgoing} onOpenTransfer={onOpenTransfer} />
        </div>
      ) : null}
    </div>
  );
}
