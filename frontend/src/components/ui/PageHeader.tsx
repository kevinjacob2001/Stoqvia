import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
};

export default function PageHeader({ title, subtitle, meta }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {meta ? <div className="page-header-meta">{meta}</div> : null}
    </header>
  );
}
