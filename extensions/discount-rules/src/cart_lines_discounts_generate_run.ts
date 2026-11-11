import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
  CartOperation,
} from "../generated/api";
import { readConfig, num } from "./config";

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const config = readConfig(input.discount.metafield?.jsonValue);
  const rate = num(input.presentmentCurrencyRate);
  const classes = input.discount.discountClasses;
  const operations: CartOperation[] = [];

  // ── PRODUCT class: bulk-buy discount on each qualifying LINE ──────────────
  if (classes.includes(DiscountClass.Product) && config.productPercent > 0) {
    const targets = input.cart.lines
      .filter((line) => line.quantity >= config.productMinQty)
      .map((line) => ({ cartLine: { id: line.id } }));

    if (targets.length > 0) {
      operations.push({
        productDiscountsAdd: {
          candidates: [
            {
              message: `${config.label}: buy ${config.productMinQty}+, ${config.productPercent}% off`,
              targets,
              value: { percentage: { value: String(config.productPercent) } },
            },
          ],
          // ALL = every candidate applies. FIRST/MAXIMUM pick just one.
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      });
    }
  }

  // ── ORDER class: spend-threshold discount on the whole subtotal ───────────
  if (classes.includes(DiscountClass.Order) && config.orderPercent > 0) {
    const subtotal = num(input.cart.cost.subtotalAmount.amount);
    if (subtotal >= config.orderMinSubtotal * rate) {
      operations.push({
        orderDiscountsAdd: {
          candidates: [
            {
              message:
                config.orderMinSubtotal > 0
                  ? `${config.label}: ${config.orderPercent}% off orders over ${config.orderMinSubtotal}`
                  : `${config.label}: ${config.orderPercent}% off`,
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
              value: { percentage: { value: String(config.orderPercent) } },
            },
          ],
          selectionStrategy: OrderDiscountSelectionStrategy.First,
        },
      });
    }
  }

  return { operations };
}
