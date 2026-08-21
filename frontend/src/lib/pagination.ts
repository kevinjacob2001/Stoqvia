export function pageCount(total: number, pageSize: number): number {
  if (pageSize < 1) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function slicePage<T>(rows: T[], page: number, pageSize: number): T[] {
  const current = clampPage(page, rows.length, pageSize);
  const start = (current - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function pagerWindow(page: number, count: number, windowSize = 5): Array<number | "ellipsis"> {
  if (count <= windowSize) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let n = start; n <= end; n += 1) items.push(n);
  if (end < count - 1) items.push("ellipsis");
  items.push(count);
  return items;
}
