import "./SurfaceCard.css";
import type { ReactNode } from "react";

type SurfaceCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "aside";
};

export default function SurfaceCard({
  title,
  description,
  actions,
  children,
  className = "",
  as: Tag = "section",
}: SurfaceCardProps) {
  const showHead = Boolean(title || description || actions);
  return (
    <Tag className={`surface-card${className ? ` ${className}` : ""}`}>
      {showHead ? (
        <div className="surface-card-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="surface-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
