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
import {useState} from 'preact/hooks';
import {
  useApplyNoteChange,
  useDeliveryGroups,
  useInstructions,
  useNote,
} from '@shopify/ui-extensions/checkout/preact';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  return (
    <s-stack gap="base">
      <DeliveryTiming />
      <DeliveryInstructions />
    </s-stack>
  );
}

function DeliveryTiming() {
  // One delivery group per shipment. A cart can split into several groups
  // (different fulfillment locations, digital vs physical), so never assume
  // groups[0] is the whole story.
  const deliveryGroups = useDeliveryGroups();

  // ⚠️ PROTECTED CUSTOMER DATA. An earlier version of this lesson called
  // `useShippingAddress()` to print "Shipping to Karachi". It typechecked and
  // built fine — then threw at runtime in a real checkout:
  //
  //   ScopeNotGrantedError: Using shipping address requires having shipping
  //   address permissions granted to your app.
  //
  // Address, name, email and phone are "protected customer data". Reading
  // them needs access requested in the Dev Dashboard (App › API access ›
  // Protected customer data), and for public apps, Shopify's review. The
  // throw takes down the WHOLE target — here it also killed the delivery
  // instructions field below. Lesson: only read buyer PII you truly need,
  // and test in a real checkout, because the type system can't catch this.

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
        Selected shipping: {titles.filter(Boolean).join(', ')}
      </s-text>
    </s-stack>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LESSON 7 · The order NOTE vs cart ATTRIBUTES.
//
// Lesson 2 stored the gift note as a cart attribute (key/value, many per
// order, mostly for apps and Order Printer). The order *note* is different:
// ONE free-text field per order, shown prominently on the order page in admin
// and on packing slips. That makes it the right home for "leave at the back
// door" — the warehouse and courier actually see it.
//
// Because there is only one note, writing it OVERWRITES whatever was there
// (including a note the buyer typed in the cart). In a real app, prefer an
// attribute if other tools also write the note.
// ───────────────────────────────────────────────────────────────────────────
function DeliveryInstructions() {
  const savedNote = useNote();
  const applyNoteChange = useApplyNoteChange();
  const instructions = useInstructions();

  const [value, setValue] = useState(savedNote ?? '');
  const [error, setError] = useState<string | undefined>(undefined);

  // Some checkouts (e.g. draft orders) lock the note. Hide the field rather
  // than show one that can never save.
  if (!instructions.notes.canUpdateNote) return null;

  async function save(next: string) {
    setError(undefined);
    const trimmed = next.trim();

    // Clearing the field should remove the note, not save an empty string.
    const result = await applyNoteChange(
      trimmed
        ? {type: 'updateNote', note: trimmed}
        : {type: 'removeNote'},
    );

    if (result.type === 'error') {
      setError(result.message ?? 'We could not save your instructions.');
    }
  }

  return (
    <s-text-area
      label="Delivery instructions (optional), e.g. gate code"
      rows={2}
      maxLength={250}
      value={value}
      error={error}
      onChange={(event: Event) => {
        const next = (event.target as HTMLTextAreaElement).value;
        setValue(next);
        void save(next);
      }}
    />
  );
}
