import "./RequestsPage.css";
import { PageHeader } from "../../../components/ui/index.ts";
import { waitingReceivedCount } from "../../../lib/transferCounts.ts";
import type { IncomingTransfer, OutgoingTransfer, RespondAction } from "../../../types.ts";
import ReceivedRequestsTable from "../ReceivedRequestsTable/index.ts";
import SentRequestsTable from "../SentRequestsTable/index.ts";

export type RequestsPageMode = "overview" | "received" | "sent";

type RequestsPageProps = {
  mode: RequestsPageMode;
  incoming: IncomingTransfer[];
  outgoing: OutgoingTransfer[];
  responding: string | null;
  onRespond: (transferId: string, action: RespondAction, qty?: number) => void;
  onOpenTransfer: (transferId: string) => void;
  onViewAllReceived?: () => void;
  onViewAllSent?: () => void;
};

export default function RequestsPage({
  mode,
  incoming,
  outgoing,
  responding,
  onRespond,
  onOpenTransfer,
  onViewAllReceived,
  onViewAllSent,
}: RequestsPageProps) {
  const waitingCount = waitingReceivedCount(incoming);

  return (
    <div className="requests-page">
      <PageHeader title="Requests" />

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
