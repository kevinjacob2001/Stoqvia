import "./PageHeader.css";
import type { ReactNode } from "react";
import Breadcrumbs, { type BreadcrumbItem } from "../Breadcrumbs/index.ts";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
};

export default function PageHeader({ title, subtitle, meta, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {meta ? <div className="page-header-meta">{meta}</div> : null}
    </header>
  );
}
