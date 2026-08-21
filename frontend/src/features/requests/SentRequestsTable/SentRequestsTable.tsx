import { IdentityCell, Pagination, ProductThumb } from "../../../components/ui/index.ts";
import { usePagedRows } from "../../../lib/usePagedRows.ts";
import type { OutgoingTransfer } from "../../../types.ts";
import InviteAvatarGroup from "../InviteAvatarGroup/index.ts";
import { REQUESTS_PAGE_SIZE, sentStatus } from "../requestCopy.ts";

type SentRequestsTableProps = {
  outgoing: OutgoingTransfer[];
  onOpenTransfer: (transferId: string) => void;
};

export default function SentRequestsTable({ outgoing, onOpenTransfer }: SentRequestsTableProps) {
  const { page, setPage, visible: rows } = usePagedRows(outgoing, REQUESTS_PAGE_SIZE);

  return (
    <section className="req-card">
      <div className="req-card-head">
        <div>
          <h2>Sent requests</h2>
          <p>Requests your store broadcast. Track until stock arrives.</p>
        </div>
      </div>

      {outgoing.length === 0 ? (
        <p className="status">No sent requests.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Invited stores</th>
                <th>Status message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = sentStatus(row);
                return (
                  <tr key={row.transfer_id}>
                    <td>
                      <IdentityCell
                        title={row.product_name}
                        subtitle={`SKU: ${row.sku}`}
                        leading={<ProductThumb name={row.product_name} />}
                      />
                    </td>
                    <td>
                      <div>{row.qty} units</div>
                      <small className={row.remaining_qty > 0 ? "req-still-need" : undefined}>
                        Still need {row.remaining_qty}
                      </small>
                    </td>
                    <td>
                      <InviteAvatarGroup invites={row.invited} />
                    </td>
                    <td>
                      <span className={`req-status ${status.tone}`}>{status.title}</span>
                      {status.detail ? <small>{status.detail}</small> : null}
                    </td>
                    <td>
                      <button className="link-button" type="button" onClick={() => onOpenTransfer(row.transfer_id)}>
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={outgoing.length} pageSize={REQUESTS_PAGE_SIZE} onChange={setPage} />
    </section>
  );
}
