import { productInitials } from "../../lib/productDisplay.ts";

type ProductThumbProps = {
  name: string;
  size?: "sm" | "lg";
};

export default function ProductThumb({ name, size = "sm" }: ProductThumbProps) {
  return (
    <div className={size === "lg" ? "drawer-thumb" : "product-thumb"} aria-hidden="true">
      {productInitials(name)}
    </div>
  );
}
