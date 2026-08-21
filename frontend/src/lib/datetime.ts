const TIME: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

export function formatDateTime(iso: string | null, withYear = true): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", withYear ? { ...TIME, year: "numeric" } : TIME);
}

export function dayCountLabel(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}
