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


export function clampRequestQty(value: number, maxQty: number): number {
  const max = Math.max(1, maxQty);
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function coverageSplit(needQty: number, selectedStores: DonorOption[]): {
  networkCover: number;
  supplierRemainder: number;
  totalSurplus: number;
} {
  const totalSurplus = selectedStores.reduce((sum, store) => sum + store.safe_surplus, 0);
  const networkCover = Math.min(Math.max(0, needQty), totalSurplus);
  return {
    totalSurplus,
    networkCover,
    supplierRemainder: Math.max(0, needQty - networkCover),
  };
}

export function flattenDonors(groups: { stores: DonorOption[] }[]): DonorOption[] {
  return groups.flatMap((group) => group.stores);
}

export type DistanceBand = {
  key: "within_5" | "within_10" | "within_20" | "over_20";
  label: string;
  stores: DonorOption[];
};

/** Frontend-only distance buckets. Empty bands are omitted. */
export function groupDonorsByDistance(stores: DonorOption[]): DistanceBand[] {
  const sorted = [...stores].sort((a, b) => a.distance_km - b.distance_km || a.store_name.localeCompare(b.store_name));
  const within5 = sorted.filter((store) => store.distance_km <= 5);
  const within10 = sorted.filter((store) => store.distance_km > 5 && store.distance_km <= 10);
  const within20 = sorted.filter((store) => store.distance_km > 10 && store.distance_km <= 20);
  const over20 = sorted.filter((store) => store.distance_km > 20);

  const bands: DistanceBand[] = [
    { key: "within_5", label: "Within 5 km", stores: within5 },
    { key: "within_10", label: "Within 10 km", stores: within10 },
    { key: "within_20", label: "Within 20 km", stores: within20 },
    { key: "over_20", label: "Over 20 km", stores: over20 },
  ];
  return bands.filter((band) => band.stores.length > 0);
}
