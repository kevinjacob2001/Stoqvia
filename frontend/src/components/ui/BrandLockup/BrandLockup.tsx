import "./BrandLockup.css";

type BrandLockupProps = {
  tone?: "light" | "dark";
  size?: "md" | "lg";
};

export default function BrandLockup({ tone = "light", size = "md" }: BrandLockupProps) {
  return (
    <div
      className={`brand-lockup brand-lockup--${tone} brand-lockup--${size}`}
      aria-label="Stoqvia × Bunnings"
    >
      <span className="brand-lockup__name">STOQVIA</span>
      <span className="brand-lockup__x" aria-hidden="true">
        ×
      </span>
      <img
        className="brand-lockup__logo"
        src="/bunnings-logo.jpg"
        alt="Bunnings Warehouse"
        width={204}
        height={76}
      />
    </div>
  );
}
