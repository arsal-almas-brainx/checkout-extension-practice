import type {
  CartFulfillmentConstraintsGenerateRunInput,
  CartFulfillmentConstraintsGenerateRunResult,
} from "../generated/api";

export function cartFulfillmentConstraintsGenerateRun(
  input: CartFulfillmentConstraintsGenerateRunInput,
): CartFulfillmentConstraintsGenerateRunResult {
  const fragileLineIds = input.cart.deliverableLines
    .filter(
      (line) =>
        line.merchandise.__typename === "ProductVariant" && line.merchandise.product.isFragile,
    )
    .map((line) => line.id);

  const locationIds = input.locations.map((l) => l.id);

  // No fragile items, or the warehouse doesn't exist → no constraint.
  // (Constraining to ZERO locations would make the item undeliverable.)
  if (fragileLineIds.length === 0 || locationIds.length === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        deliverableLinesMustFulfillFromAdd: {
          deliverableLineIds: fragileLineIds,
          locationIds,
        },
      },
    ],
  };
}
