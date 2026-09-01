export type CartItem = { sku: string; name: string; qty: number; price: number };
export type Cart = { items: CartItem[] };

export const MAX_QTY = 100;

export const SKUS: Record<string, { name: string; price: number }> = {
  "atlas-mug": { name: "Atlas Mug", price: 28 },
  "harbor-tote": { name: "Harbor Tote", price: 64 },
  "lumen-lamp": { name: "Lumen Desk Lamp", price: 120 },
  "field-notebook": { name: "Field Notebook", price: 18 },
};

function readSku(args: Record<string, unknown>): string {
  if (typeof args.sku !== "string" || args.sku.trim() === "") {
    throw new Error("sku must be a non-empty string");
  }
  const sku = args.sku.trim().toLowerCase();
  if (!Object.hasOwn(SKUS, sku)) throw new Error(`Unknown SKU: ${sku}`);
  return sku;
}

function readQuantity(args: Record<string, unknown>, fallback: number, minimum: number): number {
  const qty = args.qty ?? fallback;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < minimum || qty > MAX_QTY) {
    throw new Error(`qty must be an integer from ${minimum} to ${MAX_QTY}`);
  }
  return qty;
}

function requireItem(state: Cart, sku: string): CartItem {
  const item = state.items.find((candidate) => candidate.sku === sku);
  if (!item) throw new Error(`SKU is not in the cart: ${sku}`);
  return item;
}

export function addToCart(state: Cart, args: Record<string, unknown>): Cart {
  const sku = readSku(args);
  const qty = readQuantity(args, 1, 1);
  const meta = SKUS[sku]!;
  const existing = state.items.find((item) => item.sku === sku);
  if (existing && existing.qty + qty > MAX_QTY) {
    throw new Error(`Total quantity for ${sku} cannot exceed ${MAX_QTY}`);
  }
  return existing
    ? {
        items: state.items.map((item) =>
          item.sku === sku ? { ...item, qty: item.qty + qty } : item,
        ),
      }
    : { items: [...state.items, { sku, name: meta.name, qty, price: meta.price }] };
}

export function removeFromCart(state: Cart, args: Record<string, unknown>): Cart {
  const sku = readSku(args);
  requireItem(state, sku);
  return { items: state.items.filter((item) => item.sku !== sku) };
}

export function setQuantity(state: Cart, args: Record<string, unknown>): Cart {
  const sku = readSku(args);
  requireItem(state, sku);
  const qty = readQuantity(args, 0, 0);
  return qty === 0
    ? { items: state.items.filter((item) => item.sku !== sku) }
    : {
        items: state.items.map((item) => (item.sku === sku ? { ...item, qty } : item)),
      };
}
