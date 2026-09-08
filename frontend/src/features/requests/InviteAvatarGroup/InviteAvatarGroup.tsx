import "./InviteAvatarGroup.css";
import { Avatar } from "../../../components/ui/index.ts";
import { initials } from "../../../lib/initials.ts";
import { takeWithOverflow } from "../../../lib/list.ts";
import { transferLabel } from "../../../lib/transferLabels.ts";
import type { InviteStatus } from "../../../types.ts";

const VISIBLE_AVATARS = 2;

type InviteAvatarGroupProps = {
  invites: InviteStatus[];
};

function InviteTip({ invite }: { invite: InviteStatus }) {
  return (
    <div className="invite-tip-row">
      <span className="invite-tip-abbr">{initials(invite.store_name)}</span>
      <span className="invite-tip-body">
        <strong>{invite.store_name}</strong>
        <small>{transferLabel(invite.status)}</small>
        {invite.decline_reason ? <small>{invite.decline_reason}</small> : null}
      </span>
    </div>
  );
}

export default function InviteAvatarGroup({ invites }: InviteAvatarGroupProps) {
  const { shown, extra } = takeWithOverflow(invites, VISIBLE_AVATARS);
  const overflow = invites.slice(VISIBLE_AVATARS);

  if (invites.length === 0) {
    return <span className="muted-label">—</span>;
  }

  return (
    <div className="invite-avatar-group">
      {shown.map((inv) => (
        <span key={inv.store_id} className="invite-avatar-wrap">
          <Avatar name={inv.store_name} title="" />
          <div className="invite-tip" role="tooltip">
            <InviteTip invite={inv} />
          </div>
        </span>
      ))}
      {extra > 0 ? (
        <span className="invite-avatar-wrap">
          <span className="invite-overflow">+{extra}</span>
          <div className="invite-tip invite-tip-list" role="tooltip">
            {overflow.map((inv) => (
              <InviteTip key={inv.store_id} invite={inv} />
            ))}
          </div>
        </span>
      ) : null}
    </div>
  );
}
