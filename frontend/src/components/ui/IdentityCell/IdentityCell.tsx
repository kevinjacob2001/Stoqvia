import "./IdentityCell.css";
import type { ReactNode } from "react";

type IdentityCellProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
};

export default function IdentityCell({ title, subtitle, leading }: IdentityCellProps) {
  return (
    <div className="identity-cell">
      {leading}
      <div>
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </div>
  );
}
