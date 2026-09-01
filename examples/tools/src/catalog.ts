export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  blurb: string;
};

export const CATALOG: Product[] = [
  {
    id: "atlas-mug",
    name: "Atlas Mug",
    category: "drinkware",
    price: 28,
    blurb: "Double-wall ceramic for long desk sessions.",
  },
  {
    id: "harbor-tote",
    name: "Harbor Tote",
    category: "bags",
    price: 64,
    blurb: "Waxed canvas tote with a quiet interior pocket.",
  },
  {
    id: "lumen-lamp",
    name: "Lumen Desk Lamp",
    category: "lighting",
    price: 120,
    blurb: "Soft directional light with a weighted base.",
  },
  {
    id: "field-notebook",
    name: "Field Notebook",
    category: "stationery",
    price: 18,
    blurb: "Dot-grid pages bound in recycled kraft.",
  },
  {
    id: "north-thermos",
    name: "North Thermos",
    category: "drinkware",
    price: 42,
    blurb: "Keeps coffee hot through the afternoon stand-up.",
  },
  {
    id: "ridge-stand",
    name: "Ridge Laptop Stand",
    category: "desk",
    price: 86,
    blurb: "Machined aluminum angle for cleaner posture.",
  },
];

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOG.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.id.includes(q) ||
      p.blurb.toLowerCase().includes(q),
  );
}

export function getProduct(id: string): Product | undefined {
  return CATALOG.find((p) => p.id === id || p.name.toLowerCase() === id.toLowerCase());
}
