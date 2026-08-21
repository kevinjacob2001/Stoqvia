import type { RiskLevel } from "../types.ts";

export type StockTone = {
  label: string;
  className: string;
};

export function stockToneFromRisk(risk: RiskLevel | string | undefined): StockTone {
  if (risk === "HIGH") return { label: "Low", className: "stock-low" };
  if (risk === "MEDIUM") return { label: "Watch", className: "stock-watch" };
  if (risk === "LOW") return { label: "OK", className: "stock-ok" };
  return { label: "—", className: "" };
}

export function productInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}
