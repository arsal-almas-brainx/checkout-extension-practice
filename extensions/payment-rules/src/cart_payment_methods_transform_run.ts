import type {
  CartPaymentMethodsTransformRunInput,
  CartPaymentMethodsTransformRunResult,
  Operation,
} from "../generated/api";

type Configuration = {
  methodNameContains: string; // which method these rules are about
  maxOrderTotal: number; // hide it above this total (shop currency); 0 = never
  hideForPoBox: boolean; // hide it when shipping to a PO Box
  renameTo: string; // "" = keep Shopify's name
  moveToIndex: number; // -1 = leave the order alone
};

const DEFAULTS: Configuration = {
  methodNameContains: "Cash on Delivery",
  maxOrderTotal: 500,
  hideForPoBox: true,
  renameTo: "Cash on Delivery — pay the courier",
  moveToIndex: 0,
};

const PO_BOX = /\bp\.?\s*o\.?\s*box\b/i;

export function cartPaymentMethodsTransformRun(
  input: CartPaymentMethodsTransformRunInput,
): CartPaymentMethodsTransformRunResult {
  const raw = input.paymentCustomization.metafield?.jsonValue;
  const config: Configuration = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };

  const method = input.paymentMethods.find((m) =>
    m.name.toLowerCase().includes(config.methodNameContains.toLowerCase()),
  );
  if (!method) return { operations: [] };

  // Decimal strings again — Number() before comparing.
  const total = Number(input.cart.cost.totalAmount.amount);
  const rate = Number(input.presentmentCurrencyRate);
  const tooExpensive = config.maxOrderTotal > 0 && total > config.maxOrderTotal * rate;
  const toPoBox =
    config.hideForPoBox &&
    input.cart.deliveryGroups.some((g) => PO_BOX.test(g.deliveryAddress?.address1 ?? ""));

  // Hiding wins: once hidden, renaming or moving it is pointless.
  if (tooExpensive || toPoBox) {
    return { operations: [{ paymentMethodHide: { paymentMethodId: method.id } }] };
  }

  const operations: Operation[] = [];
  if (config.renameTo) {
    operations.push({ paymentMethodRename: { paymentMethodId: method.id, name: config.renameTo } });
  }
  if (config.moveToIndex >= 0) {
    operations.push({ paymentMethodMove: { paymentMethodId: method.id, index: config.moveToIndex } });
  }
  return { operations };
}
