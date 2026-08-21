import { useMemo, useState } from "react";
import { clampPage, slicePage } from "./pagination.ts";

export function usePagedRows<T>(rows: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const current = clampPage(page, rows.length, pageSize);
  const visible = useMemo(() => slicePage(rows, current, pageSize), [rows, current, pageSize]);
  return { page: current, setPage, visible };
}
