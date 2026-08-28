import { useState } from "react";
import { Button, ConfirmModal } from "../../../components/ui/index.ts";
import type { RespondAction } from "../../../types.ts";

type RequestActionsProps = {
  status: string;
  remainingQty: number;
  maxAcceptQty: number;
  safeSurplus: number;
  busy: boolean;
  lockedByOtherReview?: boolean;
  onRespond: (action: RespondAction, qty?: number) => void;
};

type PendingAction = "ACCEPT" | "DECLINE" | "CHECK_STOCK" | "CLEAR_CHECK" | null;

export default function RequestActions({
  status,
  remainingQty,
  maxAcceptQty,
  safeSurplus,
  busy,
  lockedByOtherReview = false,
  onRespond,
}: RequestActionsProps) {
  const reviewing = status === "CHECKING";
  const locked = lockedByOtherReview && !reviewing;
  const [pending, setPending] = useState<PendingAction>(null);
  const [acceptQty, setAcceptQty] = useState(Math.max(1, maxAcceptQty));
  const [acceptError, setAcceptError] = useState<string | null>(null);

  function openAccept() {
    if (maxAcceptQty < 1) {
      setAcceptError("You have no safe surplus for this product, so you cannot accept this transfer.");
      setPending("ACCEPT");
      return;
    }
    setAcceptQty(maxAcceptQty);
    setAcceptError(null);
    setPending("ACCEPT");
  }

  function confirmPending() {
    if (pending === "ACCEPT") {
      if (maxAcceptQty < 1) {
        setPending(null);
        return;
      }
      if (!Number.isFinite(acceptQty) || acceptQty < 1 || acceptQty > maxAcceptQty) {
        setAcceptError(`Enter a whole number between 1 and ${maxAcceptQty}.`);
        return;
      }
      onRespond("ACCEPT", acceptQty);
      setPending(null);
      return;
    }
    if (pending) {
      onRespond(pending);
      setPending(null);
    }
  }

  const reviewAction = reviewing ? "CLEAR_CHECK" : "CHECK_STOCK";
  const actionsDisabled = busy || locked;

  return (
    <>
      <Button variant="primary" disabled={actionsDisabled || maxAcceptQty < 1} onClick={openAccept}>
        Accept
      </Button>
      <Button disabled={actionsDisabled} onClick={() => setPending(reviewAction)}>
        {reviewing ? "Clear review" : "Review stock"}
      </Button>
      <Button variant="danger" disabled={actionsDisabled} onClick={() => setPending("DECLINE")}>
        Decline
      </Button>

      <ConfirmModal
        open={pending === "ACCEPT"}
        title="Accept this request?"
        message={
          maxAcceptQty < 1 ? (
            <p>You have no safe surplus for this product, so you cannot accept this transfer.</p>
          ) : (
            <p>
              Receiver still needs <strong>{remainingQty}</strong> units. You can safely send up to{" "}
              <strong>{maxAcceptQty}</strong> while staying LOW risk (surplus {safeSurplus}).
            </p>
          )
        }
        confirmLabel={maxAcceptQty < 1 ? "OK" : "Accept"}
        cancelLabel={maxAcceptQty < 1 ? "Close" : "Cancel"}
        tone="primary"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      >
        {maxAcceptQty >= 1 ? (
          <>
            <label className="confirm-field">
              Units to send
              <input
                type="number"
                min={1}
                max={maxAcceptQty}
                value={acceptQty}
                onChange={(event) => {
                  setAcceptQty(Number(event.target.value) || 0);
                  setAcceptError(null);
                }}
              />
            </label>
            {acceptError ? <p className="confirm-error">{acceptError}</p> : null}
          </>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={pending === "CHECK_STOCK" || pending === "CLEAR_CHECK"}
        title={reviewing ? "Clear stock review?" : "Start stock review?"}
        message={
          reviewing ? (
            <p>Clear the review status and return this invite to a normal pending response.</p>
          ) : (
            <p>Mark this request as under review while you check whether you can spare stock.</p>
          )
        }
        confirmLabel={reviewing ? "Clear review" : "Review stock"}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      />

      <ConfirmModal
        open={pending === "DECLINE"}
        title="Decline this request?"
        message={<p>You will not send stock for this request. This cannot be undone from the list.</p>}
        confirmLabel="Decline"
        tone="danger"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      />
    </>
  );
}
