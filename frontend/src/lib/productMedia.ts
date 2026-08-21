/** Product media mapped from seed collection (image + similar product page). */

export type ProductMedia = {
  imageUrl: string;
  productUrl: string;
};

export const PRODUCT_MEDIA_BY_SKU: Record<string, ProductMedia> = {
  "HW-PT-001": {
    imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Drill",
  },
  "HW-PT-002": {
    imageUrl: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Impact_driver",
  },
  "HW-PT-003": {
    imageUrl: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Circular_saw",
  },
  "HW-HT-004": {
    imageUrl: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Hammer",
  },
  "HW-HT-005": {
    imageUrl: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Screwdriver",
  },
  "HW-HT-006": {
    imageUrl: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Tape_measure",
  },
  "HW-TI-007": {
    imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Lumber",
  },
  "HW-TI-008": {
    imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Plywood",
  },
  "HW-PA-009": {
    imageUrl: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Paint",
  },
  "HW-PA-010": {
    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Paint",
  },
  "HW-PL-011": {
    imageUrl: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Polyvinyl_chloride",
  },
  "HW-PL-012": {
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Ball_valve",
  },
  "HW-EL-013": {
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Electrical_cable",
  },
  "HW-EL-014": {
    imageUrl: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/LED_lamp",
  },
  "HW-GA-015": {
    imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Garden_hose",
  },
  "HW-GA-016": {
    imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Fertilizer",
  },
  "HW-BM-017": {
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Cement",
  },
  "HW-BM-018": {
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Concrete",
  },
  "HW-BM-019": {
    imageUrl: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Screw",
  },
  "HW-BM-020": {
    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=400&h=400&q=80",
    productUrl: "https://en.wikipedia.org/wiki/Adhesive",
  },
};

export function productMediaForSku(sku?: string | null): ProductMedia | null {
  if (!sku) return null;
  return PRODUCT_MEDIA_BY_SKU[sku] ?? null;
}

