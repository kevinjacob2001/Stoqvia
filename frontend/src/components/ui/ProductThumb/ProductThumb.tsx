import "./ProductThumb.css";
import { useState } from "react";
import { productInitials } from "../../../lib/productDisplay.ts";
import { productMediaForSku } from "../../../lib/productMedia.ts";

type ProductThumbProps = {
  name: string;
  sku?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  size?: "sm" | "lg";
};

export default function ProductThumb({
  name,
  sku,
  imageUrl,
  productUrl,
  size = "sm",
}: ProductThumbProps) {
  const media = productMediaForSku(sku);
  const resolvedImage = imageUrl || media?.imageUrl || null;
  const resolvedLink = productUrl || media?.productUrl || null;
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(resolvedImage) && !broken;
  const className = size === "lg" ? "drawer-thumb" : "product-thumb";

  const inner = showImage ? (
    <img
      className={`${className} has-image`}
      src={resolvedImage!}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  ) : (
    <div className={className} aria-hidden="true">
      {productInitials(name)}
    </div>
  );

  if (!resolvedLink) return inner;

  return (
    <a
      className="product-thumb-link"
      href={resolvedLink}
      target="_blank"
      rel="noreferrer"
      title={`View similar product: ${name}`}
      onClick={(event) => event.stopPropagation()}
    >
      {inner}
    </a>
  );
}
