import "./Pagination.css";
import { pageCount, pagerWindow } from "../../../lib/pagination.ts";

type PaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
};

export default function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const count = pageCount(total, pageSize);
  if (total <= pageSize) return null;

  return (
    <div className="pager">
      <span className="pager-meta">
        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="pager-btns">
        <button type="button" disabled={page <= 1} onClick={() => onChange(1)} aria-label="First page">
          «
        </button>
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          ‹
        </button>
        {pagerWindow(page, count).map((item: number | "ellipsis", index: number) =>
          item === "ellipsis" ? (
            <span key={`e-${index}`} className="pager-ellipsis">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === page ? "active" : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" disabled={page >= count} onClick={() => onChange(page + 1)} aria-label="Next page">
          ›
        </button>
        <button type="button" disabled={page >= count} onClick={() => onChange(count)} aria-label="Last page">
          »
        </button>
      </div>
    </div>
  );
}
