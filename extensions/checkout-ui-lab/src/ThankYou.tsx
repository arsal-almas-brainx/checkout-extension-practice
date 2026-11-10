// ═══════════════════════════════════════════════════════════════════════════
// LESSON 5  ·  target: purchase.thank-you.block.render
//
// Two things to internalise about the Thank you page:
//
// 1. This target REPLACED `checkout.liquid` and "Additional scripts". Those
//    were sunset on the Thank you and Order status pages on 2025-08-28 for
//    Plus stores (2026-08-26 for non-Plus). Any legacy tracking still sitting
//    there is already dead and has to move here, or into a web pixel
//    extension if it is purely analytics.
//
// 2. The checkout APIs are GONE here. The order already exists, so there is no
//    cart to mutate, no buyer to block, no applyAttributeChange. Hooks like
//    useTotalAmount would throw. You read the result instead, via the target's
//    own API object.
//
// This is also the lesson on `useApi` + `useSubscription`: not every API has a
// dedicated hook. When it doesn't, grab the target's api object and subscribe
// to the signal yourself.
// ═══════════════════════════════════════════════════════════════════════════
import '@shopify/ui-extensions/preact';
import type {} from '@shopify/ui-extensions/purchase.thank-you.block.render';
import {render} from 'preact';
import {useApi, useSubscription} from '@shopify/ui-extensions/checkout/preact';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  // Passing the target as a type argument is what narrows `api` to the
  // properties this target actually has — here, `orderConfirmation`.
  const {orderConfirmation} = useApi<'purchase.thank-you.block.render'>();

  // orderConfirmation is a SubscribableSignalLike, not a plain value, so it
  // needs useSubscription to become reactive React-style state.
  const confirmation = useSubscription(orderConfirmation);

  // Not resolved on first paint. A skeleton avoids a layout jump.
  if (!confirmation) return <s-skeleton-paragraph />;

  // `number` is optional — orders created before it existed have none, so
  // never render it unguarded.
  const orderNumber = confirmation.number;

  return (
    <s-section heading="What happens next">
      <s-stack gap="base">
        <s-text>
          {orderNumber
            ? `Order ${orderNumber} is confirmed.`
            : 'Your order is confirmed.'}{' '}
          You'll get a shipping email with tracking within 2 business days.
        </s-text>

        {/* isFirstOrder is a genuinely useful upsell/welcome signal that costs
            you nothing to check. */}
        {confirmation.isFirstOrder ? (
          <s-banner tone="success" heading="Welcome — first order!">
            <s-text>
              Use code WELCOME10 for 10% off your next purchase.
            </s-text>
          </s-banner>
        ) : null}

        {/* Prefer s-link over a raw anchor: it inherits checkout styling and
            opens correctly inside the Shop mobile app. */}
        <s-link href="https://help.example.com/orders">
          Track or change this order
        </s-link>
      </s-stack>
    </s-section>
  );
}
