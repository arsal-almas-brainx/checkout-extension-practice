import {
  DeliveryDiscountSelectionStrategy,
  DeliveryMethod,
  DiscountClass,
  DeliveryInput,
  CartDeliveryOptionsDiscountsGenerateRunResult,
} from "../generated/api";
import { readConfig, num } from "./config";

export function cartDeliveryOptionsDiscountsGenerateRun(
  input: DeliveryInput,
): CartDeliveryOptionsDiscountsGenerateRunResult {
  const config = readConfig(input.discount.metafield?.jsonValue);
  if (
    !input.discount.discountClasses.includes(DiscountClass.Shipping) ||
    config.freeShippingMinSubtotal <= 0
  ) {
    return { operations: [] };
  }

  const subtotal = num(input.cart.cost.subtotalAmount.amount);
  if (subtotal < config.freeShippingMinSubtotal * num(input.presentmentCurrencyRate)) {
    return { operations: [] };
  }

  // Only groups that are actually SHIPPED (not local pickup).
  const targets = input.cart.deliveryGroups
    .filter(({ deliveryOptions }) =>
      deliveryOptions.some((o) => o.deliveryMethodType === DeliveryMethod.Shipping),
    )
    .map(({ id }) => ({ deliveryGroup: { id } }));

  if (targets.length === 0) return { operations: [] };

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: `${config.label}: free shipping over ${config.freeShippingMinSubtotal}`,
              targets,
              value: { percentage: { value: "100" } },
            },
          ],
          selectionStrategy: DeliveryDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
