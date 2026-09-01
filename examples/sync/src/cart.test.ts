import { describe, expect, test } from "bun:test";
import { MAX_QTY, addToCart, removeFromCart, setQuantity, type Cart } from "./cart";

const empty: Cart = { items: [] };

describe("cart mutations", () => {
  test("rejects unknown and missing SKUs", () => {
    expect(() => addToCart(empty, { sku: "unknown" })).toThrow("Unknown SKU");
    expect(() => removeFromCart(empty, { sku: "atlas-mug" })).toThrow("not in the cart");
    expect(() => setQuantity(empty, { sku: "atlas-mug", qty: 1 })).toThrow("not in the cart");
  });

  test("rejects invalid quantities and total overflow", () => {
    for (const qty of [NaN, Infinity, 1.5, -1, MAX_QTY + 1]) {
      expect(() => addToCart(empty, { sku: "atlas-mug", qty })).toThrow(
        "qty must be an integer",
      );
    }
    const full = addToCart(empty, { sku: "atlas-mug", qty: MAX_QTY });
    expect(() => addToCart(full, { sku: "atlas-mug", qty: 1 })).toThrow("cannot exceed");
  });

  test("adds, updates, and removes valid items", () => {
    const added = addToCart(empty, { sku: "atlas-mug", qty: 2 });
    expect(added.items[0]?.qty).toBe(2);
    expect(setQuantity(added, { sku: "atlas-mug", qty: 3 }).items[0]?.qty).toBe(3);
    expect(removeFromCart(added, { sku: "atlas-mug" }).items).toEqual([]);
  });
});
