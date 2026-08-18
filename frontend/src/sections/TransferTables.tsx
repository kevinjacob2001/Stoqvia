import type { IncomingTransfer, OutgoingTransfer } from "../types.ts";

type TransferTablesProps = {
  mode: "received" | "transferred";
  outgoing: OutgoingTransfer[];
  incoming: IncomingTransfer[];
};

export default function TransferTables({ mode, outgoing, incoming }: TransferTablesProps) {
  if (mode === "transferred") {
    return (
      <section className="panel">
        <h2>Transferred</h2>
        {outgoing.length === 0 ? (
          <p className="status">No transferred products.</p>
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
                    <small>{row.sku}</small>
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
    );
  }

  return (
    <section className="panel">
      <h2>Received</h2>
      {incoming.length === 0 ? (
        <p className="status">No received requests.</p>
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
                  <small>{row.sku}</small>
                </td>
                <td className="num">{row.qty}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
