// Shared by both targets. Every value is optional in the metafield — anything
// missing falls back to these defaults, and 0 switches that tier off.
export type DiscountConfig = {
  productMinQty: number; // Lesson 10: buy this many of one line...
  productPercent: number; // ...and that line gets this % off
  orderMinSubtotal: number; // Lesson 10: spend this much (shop currency)...
  orderPercent: number; // ...and the order gets this % off
  freeShippingMinSubtotal: number; // spend this much and shipping is free
  label: string; // shown to the buyer next to each discount
};

export const DEFAULTS: DiscountConfig = {
  productMinQty: 3,
  productPercent: 10,
  orderMinSubtotal: 300,
  orderPercent: 15,
  freeShippingMinSubtotal: 500,
  label: "Training",
};

export function readConfig(jsonValue: unknown): DiscountConfig {
  const raw = (jsonValue && typeof jsonValue === "object" ? jsonValue : {}) as Partial<DiscountConfig>;
  return { ...DEFAULTS, ...raw };
}

// Money/Decimal fields arrive as STRINGS ("120.0"), same trap as Lesson 7.
export const num = (v: unknown) => Number(v ?? 0);
// The reverse trap on OUTPUT: Decimal fields (like a percentage value) are
// typed as string too. The generated types enforce it — pass String(n).
