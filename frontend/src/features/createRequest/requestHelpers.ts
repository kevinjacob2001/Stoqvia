import type { DonorOption } from "../../types.ts";

export function leadTimeLabel(days: number): string {
  if (days <= 1) return "Same day";
  return `${days} days`;
}

export function forecastImpactLabel(store: DonorOption, needQty: number): {
  label: string;
  tone: "minimal" | "low" | "medium" | "high";
} {
  if (store.safe_surplus >= needQty) return { label: "Minimal", tone: "minimal" };
  if (store.safe_surplus >= needQty * 0.5) return { label: "Low", tone: "low" };
  if (store.safe_surplus > 0) return { label: "Medium", tone: "medium" };
  return { label: "High", tone: "high" };
}

export function flattenDonors(groups: { stores: DonorOption[] }[]): DonorOption[] {
  return groups.flatMap((group) => group.stores);
}
