import type { RiskLevel } from "../../types.ts";

type RiskBadgeProps = {
  risk: RiskLevel | string;
};

export default function RiskBadge({ risk }: RiskBadgeProps) {
  return <span className={`risk risk-${String(risk).toLowerCase()}`}>{risk}</span>;
}
