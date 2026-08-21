export function initials(name: string, maxParts = 2): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, maxParts).toUpperCase();
  return parts
    .slice(0, maxParts)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
