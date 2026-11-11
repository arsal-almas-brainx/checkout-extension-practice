import type {
  CartTransformRunInput,
  CartTransformRunResult,
  Operation,
} from "../generated/api";

// Metafield JSON on the kit's variant:
//   [{ "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 }, …]
type Component = { variantId: string; quantity: number };

function readComponents(jsonValue: unknown): Component[] {
  if (!Array.isArray(jsonValue)) return [];
  return jsonValue.filter(
    (c): c is Component =>
      c && typeof c.variantId === "string" && Number.isInteger(c.quantity) && c.quantity > 0,
  );
}

export function cartTransformRun(input: CartTransformRunInput): CartTransformRunResult {
  const operations: Operation[] = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const components = readComponents(line.merchandise.components?.jsonValue);
    if (components.length === 0) continue; // an ordinary product — leave it

    operations.push({
      lineExpand: {
        cartLineId: line.id,
        // Quantities are PER KIT: Shopify multiplies by the line's quantity.
        expandedCartItems: components.map((c) => ({
          merchandiseId: c.variantId,
          quantity: c.quantity,
        })),
        // No `price` → the buyer pays the kit's own price, and Shopify splits
        // it across the components in proportion to their normal prices.
        title: line.merchandise.product.title,
      },
    });
  }

  return { operations };
}
