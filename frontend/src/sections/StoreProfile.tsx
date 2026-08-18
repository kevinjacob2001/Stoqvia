import type { MeResponse } from "../types.ts";

type StoreProfileProps = {
  session: MeResponse;
};

export default function StoreProfile({ session }: StoreProfileProps) {
  return (
    <aside className="panel">
      <strong>This store</strong>
      <p className="store-profile-name">{session.store_name}</p>
      <small>{session.region}</small>
      <small>Signed in as {session.username}</small>
    </aside>
  );
}
