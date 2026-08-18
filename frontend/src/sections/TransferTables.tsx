import type { IncomingTransfer, OutgoingTransfer } from "../types.ts";

type TransferTablesProps = {
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
  outgoingCount: number;
  incomingCount: number;
};

export default function TransferTables({
  outgoing,
  incoming,
  outgoingCount,
  incomingCount,
}: TransferTablesProps) {
  return (
    <div className="transfer-tables">
      <section className="panel">
        <h2>
          Transferred
          <small> · {outgoingCount}</small>
        </h2>
        {outgoingCount === 0 ? (
          <p className="status">No transferred products</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Qty</th>
                <th>Asked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {outgoing.map((row) => (
                <tr key={row.transfer_id}>
                  <td>
                    {row.product_name}
                    <small> {row.sku}</small>
                  </td>
                  <td className="num">{row.qty}</td>
                  <td>{row.invited.map((invite) => invite.store_name).join(", ")}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="panel">
        <h2>
          Received
          <small> · {incomingCount}</small>
        </h2>
        {incomingCount === 0 ? (
          <p className="status">No received requests</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>Product</th>
                <th className="num">Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {incoming.map((row) => (
                <tr key={row.transfer_id}>
                  <td>{row.requester_store_name}</td>
                  <td>
                    {row.product_name}
                    <small> {row.sku}</small>
                  </td>
                  <td className="num">{row.qty}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
