type MetricTone = "green" | "blue" | "orange" | "purple";

type MetricCardProps = {
  title: string;
  value: string;
  hint: string;
  tone?: MetricTone;
};

export default function MetricCard({ title, value, hint, tone = "green" }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-copy">
        <p className="metric-title">{title}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-hint">{hint}</p>
      </div>
    </article>
  );
}
