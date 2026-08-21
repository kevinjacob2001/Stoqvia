type IconProps = {
  path: string;
  className?: string;
  size?: number;
};

export default function Icon({ path, className = "nav-icon", size = 18 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

export const ICON_PATHS = {
  products: "M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z",
  requests: "M4 4h16v4H4V4zm0 6h16v10H4V10zm4 2v2h8v-2H8z",
  fulfill: "M3 7h11v8H3V7zm12 2h3.5L21 12.5V15h-1.1a2.5 2.5 0 0 1-4.8 0H13v-2h2V9z",
  alerts: "M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z",
} as const;
