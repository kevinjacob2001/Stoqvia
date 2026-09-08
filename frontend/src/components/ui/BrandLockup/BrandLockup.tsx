import "./BrandLockup.css";

type BrandLockupProps = {
  tone?: "light" | "dark";
  size?: "md" | "lg";
};

export default function BrandLockup({ tone = "light", size = "md" }: BrandLockupProps) {
  return (
    <div className={`brand-lockup brand-lockup--${tone} brand-lockup--${size}`} aria-label="Stoqvia">
      <span className="brand-lockup__name">STOQVIA</span>
    </div>
  );
}
