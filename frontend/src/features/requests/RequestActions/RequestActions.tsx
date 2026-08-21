import { Button } from "../../../components/ui/index.ts";
import type { RespondAction } from "../../../types.ts";

type RequestActionsProps = {
  status: string;
  remainingQty: number;
  maxAcceptQty: number;
  safeSurplus: number;
  busy: boolean;
  onRespond: (action: RespondAction, qty?: number) => void;
};

function promptAcceptQty(remainingQty: number, maxAcceptQty: number, safeSurplus: number): number | null {
  if (maxAcceptQty < 1) {
    window.alert("You have no safe surplus for this product, so you cannot accept this transfer.");
    return null;
  }
  const raw = window.prompt(
    `How many units can you safely fulfil? (1–${maxAcceptQty})\n` +
      `Receiver still needs ${remainingQty}. Max that keeps your risk LOW: ${safeSurplus}.`,
    String(maxAcceptQty),
  );
  if (raw == null) return null;
  const qty = Number.parseInt(raw, 10);
  if (!Number.isFinite(qty) || qty < 1 || qty > maxAcceptQty) {
    window.alert(`Enter a whole number between 1 and ${maxAcceptQty} (capped by need and your safe surplus).`);
    return null;
  }
  return qty;
}

export default function RequestActions({
  status,
  remainingQty,
  maxAcceptQty,
  safeSurplus,
  busy,
  onRespond,
}: RequestActionsProps) {
  const reviewing = status === "CHECKING";

  return (
    <>
      <Button
        variant="primary"
        disabled={busy || maxAcceptQty < 1}
        onClick={() => {
          const qty = promptAcceptQty(remainingQty, maxAcceptQty, safeSurplus);
          if (qty != null) onRespond("ACCEPT", qty);
        }}
      >
        Accept
      </Button>
      <Button disabled={busy} onClick={() => onRespond(reviewing ? "CLEAR_CHECK" : "CHECK_STOCK")}>
        {reviewing ? "Clear review" : "Review stock"}
      </Button>
      <Button variant="danger" disabled={busy} onClick={() => onRespond("DECLINE")}>
        Decline
      </Button>
    </>
  );
}
