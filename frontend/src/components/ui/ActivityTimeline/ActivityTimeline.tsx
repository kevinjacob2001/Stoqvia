import "./ActivityTimeline.css";

export type ActivityTimelineItem = {
  id: string;
  title: string;
  subtitle: string;
};

type ActivityTimelineProps = {
  items: ActivityTimelineItem[];
  emptyLabel?: string;
};

export default function ActivityTimeline({
  items,
  emptyLabel = "No activity recorded yet.",
}: ActivityTimelineProps) {
  if (items.length === 0) {
    return <p className="activity-timeline-empty">{emptyLabel}</p>;
  }
  return (
    <ul className="activity-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <div className="activity-timeline-dot" aria-hidden="true" />
          <div>
            <strong>{item.title}</strong>
            <small>{item.subtitle}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
