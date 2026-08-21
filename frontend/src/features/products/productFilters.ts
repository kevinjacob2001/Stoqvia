import type { ActiveFulfillment } from "../../lib/fulfillments.ts";
import type { ForecastResponse, InventoryItem } from "../../types.ts";

export type ProductTabKey = "all" | "low" | "high" | "requested";

export const PRODUCT_TABS: ReadonlyArray<{ key: ProductTabKey; label: string }> = [
  { key: "all", label: "All Products" },
  { key: "low", label: "Low Stock" },
  { key: "high", label: "High Demand" },
  { key: "requested", label: "Recently Requested" },
];

export function filterProducts(
  items: InventoryItem[],
  forecasts: Record<string, ForecastResponse>,
  activeByProduct: Record<string, ActiveFulfillment>,
  tab: ProductTabKey,
  query: string,
): InventoryItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    const forecast = forecasts[item.product_id];
    const risk = forecast?.risk;
    const active = activeByProduct[item.product_id];
    if (tab === "low" && risk !== "HIGH") return false;
    if (tab === "high" && !(forecast && forecast.predicted_7d_demand > 0 && risk !== "LOW")) return false;
    if (tab === "requested" && !active) return false;
    if (!q) return true;
    return (
      item.product_name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.product_id.toLowerCase().includes(q)
    );
  });
}

export function summarizeRisk(
  items: InventoryItem[],
  forecasts: Record<string, ForecastResponse>,
): { total: number; high: number; medium: number; low: number } {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const item of items) {
    const risk = forecasts[item.product_id]?.risk;
    if (risk === "HIGH") high += 1;
    else if (risk === "MEDIUM") medium += 1;
    else if (risk === "LOW") low += 1;
  }
  return { total: items.length, high, medium, low };
}
