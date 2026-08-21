import "./Avatar.css";
import { initials } from "../../../lib/initials.ts";

type AvatarProps = {
  name: string;
  title?: string;
};

export default function Avatar({ name, title }: AvatarProps) {
  return (
    <span className="avatar-chip" title={title ?? name}>
      {initials(name)}
    </span>
  );
}
