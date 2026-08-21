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
  const inactive = total <= pageSize;
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={`pager${inactive ? " pager-inactive" : ""}`}>
      <span className="pager-meta">
        Showing {from} to {to} of {total}
      </span>
      <div className="pager-btns" aria-disabled={inactive || undefined}>
        <button
          type="button"
          disabled={inactive || page <= 1}
          onClick={() => onChange(1)}
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          disabled={inactive || page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
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
              disabled={inactive}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={inactive || page >= count}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
        <button
          type="button"
          disabled={inactive || page >= count}
          onClick={() => onChange(count)}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
