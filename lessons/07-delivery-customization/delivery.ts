// ═══════════════════════════════════════════════════════════════════════════
// LESSON 7 · Delivery Customization Function
// target: cart.delivery-options.transform.run
//
// Same pure (input) => output contract as Lesson 6. The difference is that you
// don't return errors, you return OPERATIONS — a declarative list of edits
// Shopify applies to the option list:
//
//   deliveryOptionHide   { deliveryOptionHandle }
//   deliveryOptionRename { deliveryOptionHandle, title }
//   deliveryOptionMove   { deliveryOptionHandle, index }
//
// You never mutate the input. You describe the diff and hand it back.
// ═══════════════════════════════════════════════════════════════════════════
import type {
  CartDeliveryOptionsTransformRunInput,
  CartDeliveryOptionsTransformRunResult,
} from '../generated/api';

/** Carrier codes → language a buyer understands. */
const RENAME_RULES: {match: RegExp; title: string}[] = [
  {match: /priority.*2.?day|2.?day/i, title: 'Express — arrives in 2 days'},
  {match: /ground|standard|parcel.?select/i, title: 'Standard — 3 to 5 days'},
  {match: /overnight|next.?day/i, title: 'Overnight — next business day'},
  {match: /economy|saver|surepost/i, title: 'Economy — up to 10 days (no tracking)'},
];

/** Provinces we won't promise express delivery to. */
const NO_EXPRESS_PROVINCES = new Set(['AK', 'HI', 'PR', 'GU', 'VI']);

function isPoBox(line: string): boolean {
  const n = line.toLowerCase().replace(/[.\s-]/g, '');
  return n.includes('pobox') || n.includes('postofficebox');
}

export function cartDeliveryOptionsTransformRun(
  input: CartDeliveryOptionsTransformRunInput,
): CartDeliveryOptionsTransformRunResult {
  const operations: CartDeliveryOptionsTransformRunResult['operations'] = [];

  for (const group of input.cart.deliveryGroups) {
    const options = group.deliveryOptions;
    if (options.length === 0) continue;

    const address = group.deliveryAddress;
    const addressLine = `${address?.address1 ?? ''} ${address?.address2 ?? ''}`;
    const expressUnavailable =
      isPoBox(addressLine) ||
      NO_EXPRESS_PROVINCES.has(address?.provinceCode ?? '');

    // ── 1 · Hide what we can't actually deliver ──────────────────────────
    //
    // keepAtLeastOne: Shopify DISCARDS your hide operations for a group if
    // they would empty it — it will not hand the buyer an uncompletable
    // checkout. That's a safety net, not a strategy: if it trips, none of
    // your hides apply and the buyer sees the raw carrier list, express
    // included. So compute the survivors first and only hide while at least
    // one option remains.
    const wouldHide = expressUnavailable
      ? options.filter((o) => /express|overnight|next.?day|2.?day/i.test(o.title ?? ''))
      : [];

    const keepAtLeastOne = wouldHide.length < options.length;

    if (keepAtLeastOne) {
      for (const option of wouldHide) {
        operations.push({
          deliveryOptionHide: {deliveryOptionHandle: option.handle},
        });
      }
    }

    const hiddenHandles = new Set(
      keepAtLeastOne ? wouldHide.map((o) => o.handle) : [],
    );
    const visible = options.filter((o) => !hiddenHandles.has(o.handle));

    // ── 2 · Rename carrier codes into plain language ─────────────────────
    for (const option of visible) {
      const title = option.title ?? '';
      const rule = RENAME_RULES.find((r) => r.match.test(title));

      // Only emit a rename when it actually changes something. Emitting a
      // no-op rename is harmless but it makes the operations list noisy and
      // much harder to debug with `shopify app function run`.
      if (rule && rule.title !== title) {
        operations.push({
          deliveryOptionRename: {
            deliveryOptionHandle: option.handle,
            title: rule.title,
          },
        });
      }
    }

    // ── 3 · Put the cheapest option first ────────────────────────────────
    //
    // Buyers scan top-down. Leading with the cheapest option reduces the
    // "shipping costs HOW much?" bounce.
    //
    // `index` is 0-based and applies to the list AFTER hides. Sorting a copy
    // matters — sort() mutates, and mutating `visible` here would corrupt the
    // renames we just derived from it if this block ever moves above them.
    const cheapest = [...visible].sort(
      (a, b) => (a.cost?.amount ?? 0) - (b.cost?.amount ?? 0),
    )[0];

    if (cheapest && visible[0]?.handle !== cheapest.handle) {
      operations.push({
        deliveryOptionMove: {
          deliveryOptionHandle: cheapest.handle,
          index: 0,
        },
      });
    }
  }

  return {operations};
}
