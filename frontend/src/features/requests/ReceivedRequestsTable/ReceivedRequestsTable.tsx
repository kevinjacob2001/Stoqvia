import { Avatar, IdentityCell, Pagination, ProductThumb, SurfaceCard } from "../../../components/ui/index.ts";
import { isActionableInvite } from "../../../lib/transferCounts.ts";
import { usePagedRows } from "../../../lib/usePagedRows.ts";
import type { IncomingTransfer, RespondAction } from "../../../types.ts";
import RequestActions from "../RequestActions/index.ts";
import { receivedStatus, REQUESTS_PAGE_SIZE } from "../requestCopy.ts";

type ReceivedRequestsTableProps = {
  incoming: IncomingTransfer[];
  responding: string | null;
  onRespond: (transferId: string, action: RespondAction, qty?: number) => void;
  onOpenTransfer: (transferId: string) => void;
};

export default function ReceivedRequestsTable({
  incoming,
  responding,
  onRespond,
  onOpenTransfer,
}: ReceivedRequestsTableProps) {
  const { page, setPage, visible: rows } = usePagedRows(incoming, REQUESTS_PAGE_SIZE);

  return (
    <SurfaceCard
      title="Received requests"
      description="Respond to requests sent to your store. After you accept, confirm dispatch on Accepted."
    >
      {incoming.length === 0 ? (
        <p className="status">No received requests.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>From store</th>
                <th>Product (SKU)</th>
                <th>Still need</th>
                <th>Status message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = receivedStatus(row);
                const distance =
                  row.requester_distance_km != null ? `${row.requester_distance_km.toFixed(1)} km` : null;
                const actionable = isActionableInvite(row.my_status);
                return (
                  <tr key={row.transfer_id}>
                    <td>
                      <IdentityCell
                        title={row.requester_store_name}
                        subtitle={distance ?? undefined}
                        leading={<Avatar name={row.requester_store_name} />}
                      />
                    </td>
                    <td>
                      <IdentityCell
                        title={row.product_name}
                        subtitle={`SKU: ${row.sku}`}
                        leading={<ProductThumb name={row.product_name} sku={row.sku} />}
                      />
                    </td>
                    <td>
                      <div className="req-need">
                        + {row.remaining_qty} of {row.qty} units
                      </div>
                      {row.max_accept_qty != null ? (
                        <small>Safe to send up to {row.max_accept_qty}</small>
                      ) : row.my_accepted_qty != null ? (
                        <small>You sent {row.my_accepted_qty}</small>
                      ) : row.fulfilled_other_store_count > 0 ? (
                        <small>
                          {row.fulfilled_other_store_count} other store
                          {row.fulfilled_other_store_count === 1 ? "" : "s"} already fulfilled
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <span className={`req-status ${status.tone}`}>{status.title}</span>
                    </td>
                    <td>
                      <div className="req-actions">
                        {actionable ? (
                          <RequestActions
                            status={row.my_status}
                            remainingQty={row.remaining_qty}
                            maxAcceptQty={row.max_accept_qty ?? 0}
                            safeSurplus={row.safe_surplus ?? 0}
                            busy={responding === row.transfer_id}
                            onRespond={(action, qty) => onRespond(row.transfer_id, action, qty)}
                          />
                        ) : null}
                        <button className="link-button" type="button" onClick={() => onOpenTransfer(row.transfer_id)}>
                          {actionable ? "Details" : "View details"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={incoming.length} pageSize={REQUESTS_PAGE_SIZE} onChange={setPage} />
    </SurfaceCard>
  );
}
