export function takeWithOverflow<T>(items: T[], limit: number): { shown: T[]; extra: number } {
  return { shown: items.slice(0, limit), extra: Math.max(0, items.length - limit) };
}
