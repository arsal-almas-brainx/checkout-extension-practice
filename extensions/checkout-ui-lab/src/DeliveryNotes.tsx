// ═══════════════════════════════════════════════════════════════════════════
// LESSON 4  ·  target: purchase.checkout.shipping-option-list.render-after
//
// STATIC vs DYNAMIC targets — the distinction that decides how merchants
// experience your app:
//
//   purchase.checkout.block.render                      → DYNAMIC.
//     Invisible until a merchant drags it somewhere in the checkout editor.
//     Maximum flexibility; you cannot rely on it existing or on its position.
//
//   purchase.checkout.shipping-option-list.render-after → STATIC.
//     Renders automatically, always directly after the shipping options.
//     No editor step, so it cannot be misplaced or forgotten.
//
// Rule of thumb: if the content is only meaningful beside one specific
// checkout element, use that element's static target. Otherwise use a block
// and let the merchant decide.
// ═══════════════════════════════════════════════════════════════════════════
import '@shopify/ui-extensions/preact';
import type {} from '@shopify/ui-extensions/purchase.checkout.shipping-option-list.render-after';
import {render} from 'preact';
import {
  useDeliveryGroups,
  useShippingAddress,
} from '@shopify/ui-extensions/checkout/preact';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  // One delivery group per shipment. A cart can split into several groups
  // (different fulfillment locations, digital vs physical), so never assume
  // groups[0] is the whole story.
  const deliveryGroups = useDeliveryGroups();
  const shippingAddress = useShippingAddress();

  // ⚠️ The trap here: `selectedDeliveryOption` is a *reference* — it only
  // carries a `handle`, not a title or price. To get the human-readable
  // details you must match that handle against the group's `deliveryOptions`.
  // Reaching for `selectedDeliveryOption.title` is the single most common
  // mistake with this API and it does not typecheck.
  const selected = deliveryGroups.flatMap((group) => {
    const handle = group.selectedDeliveryOption?.handle;
    if (!handle) return [];
    const option = group.deliveryOptions.find((o) => o.handle === handle);
    return option ? [option] : [];
  });

  // Before the buyer enters an address there is nothing selected. Render
  // nothing rather than a half-empty box.
  if (selected.length === 0) return null;

  // Set expectations up front. This kind of small honesty measurably cuts
  // "where is my order?" support tickets.
  const titles = selected.map((option) => option.title ?? '');
  const hasEconomy = titles.some((title) =>
    /economy|standard|ground|saver/i.test(title),
  );

  return (
    <s-stack gap="small-200">
      {hasEconomy ? (
        <s-banner tone="warning" heading="Delivery timing">
          <s-text>
            Economy shipping is not tracked door to door and can take up to 10
            business days. Choose an expedited option if you need tracking.
          </s-text>
        </s-banner>
      ) : null}

      <s-text color="subdued">
        Shipping to {shippingAddress?.city ?? 'your address'} —{' '}
        {titles.filter(Boolean).join(', ')}
      </s-text>
    </s-stack>
  );
}
