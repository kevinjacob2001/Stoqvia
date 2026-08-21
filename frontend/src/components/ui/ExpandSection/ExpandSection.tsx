import "./ExpandSection.css";
import { useState, type ReactNode } from "react";

type ExpandSectionProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  variant?: "panel" | "inline";
  children: ReactNode;
};

export default function ExpandSection({
  title,
  summary,
  defaultOpen = false,
  variant = "panel",
  children,
}: ExpandSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`expand-section variant-${variant}${open ? " open" : ""}`}>
      <button
        type="button"
        className="expand-section-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span className="expand-section-chevron" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="expand-section-body">{children}</div> : null}
    </section>
  );
}
