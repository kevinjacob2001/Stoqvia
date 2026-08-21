import { dayCountLabel } from "../../lib/datetime.ts";
import type { DonorOption } from "../../types.ts";

export function leadTimeLabel(days: number): string {
  if (days <= 1) return "Same day";
  return dayCountLabel(days);
}

export function sendImpactLabel(store: DonorOption, needQty: number): {
  label: "Low" | "Medium" | "High";
  tone: "low" | "medium" | "high";
} {
  // Frontend-only: how hard covering this request is for the donor, from backend safe_surplus.
  // Not the same as product Risk (LOW/MEDIUM/HIGH from forecast classify_risk).
  if (needQty <= 0 || store.safe_surplus >= needQty) {
    return { label: "Low", tone: "low" };
  }
  if (store.safe_surplus > 0) {
    return { label: "Medium", tone: "medium" };
  }
  return { label: "High", tone: "high" };
}


export function flattenDonors(groups: { stores: DonorOption[] }[]): DonorOption[] {
  return groups.flatMap((group) => group.stores);
}
