import "./ProgressTrack.css";

export type ProgressTrackStage = {
  id: string;
  label: string;
  time?: string | null;
  done: boolean;
  current?: boolean;
};

type ProgressTrackProps = {
  stages: ProgressTrackStage[];
};

export default function ProgressTrack({ stages }: ProgressTrackProps) {
  return (
    <ol className="progress-track">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className={`progress-track-step${stage.done ? " done" : ""}${stage.current ? " current" : ""}`}
        >
          <div className="progress-track-rail">
            <span className="progress-track-dot" />
          </div>
          <div className="progress-track-copy">
            <strong>{stage.label}</strong>
            {stage.time != null && stage.time !== "" ? <small>{stage.time}</small> : <small>—</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}
