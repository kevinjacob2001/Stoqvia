import "./StatusBadge.css";
import type { ReactNode } from "react";

export type StatusTone = "ok" | "info" | "warn" | "purple" | "danger" | "muted";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
  size?: "md" | "sm";
};

export default function StatusBadge({ children, tone = "muted", size = "md" }: StatusBadgeProps) {
  return <span className={`status-badge size-${size} tone-${tone}`}>{children}</span>;
}
