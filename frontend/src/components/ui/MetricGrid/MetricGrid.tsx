import "./MetricGrid.css";
import type { ReactNode } from "react";

export type MetricGridItem = {
  label: string;
  value: ReactNode;
  warn?: boolean;
  ok?: boolean;
};

type MetricGridProps = {
  items: MetricGridItem[];
  variant?: "tiles" | "rows";
};

export default function MetricGrid({ items, variant = "tiles" }: MetricGridProps) {
  return (
    <dl className={`metric-grid variant-${variant}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.warn ? "stock-warn" : item.ok ? "stock-ok" : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
