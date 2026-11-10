// ═══════════════════════════════════════════════════════════════════════════
// LESSONS 1–3  ·  target: purchase.checkout.block.render
//
// THE THREE IMPORTS, and why each one exists. Getting these wrong is the most
// common reason a checkout extension won't compile:
//
//   1. '@shopify/ui-extensions/preact'  (RUNTIME, side-effect only)
//        Hands Preact's Signal class to the checkout host so signal-backed
//        APIs can push updates into your component tree. No exports.
//
//   2. '@shopify/ui-extensions/purchase.checkout.block.render'  (TYPES ONLY)
//        Registers the <s-*> JSX elements available AT THIS TARGET, plus the
//        target's `Api` type. There is one such module per target because
//        different targets expose different components.
//        ⚠️ Write it as `import type {} from ...`. The path resolves to a
//        .d.ts with no JavaScript behind it, so a bare `import '...'` is
//        asking the bundler to load a type declaration at runtime. esbuild
//        happens to drop it with a warning (the package marks it
//        side-effect-free), so it may look harmless — but it is still wrong,
//        and stricter bundler setups fail on it outright. `import type`
//        states the intent and is erased cleanly.
//
//   3. '@shopify/ui-extensions/checkout/preact'  (the hooks)
//        useTotalAmount, useSettings, useApplyAttributeChange, and ~70 more.
//
// Note there is NO rich global `shopify` object on the checkout surface — that
// pattern belongs to the Admin and Customer Account surfaces. On checkout you
// use hooks. Tutorials that show `shopify.cost.totalAmount.value` in a
// checkout extension are describing a different surface.
// ═══════════════════════════════════════════════════════════════════════════
import '@shopify/ui-extensions/preact';
import type {} from '@shopify/ui-extensions/purchase.checkout.block.render';
import {render} from 'preact';
import {useState} from 'preact/hooks';
import {
  useApplyAttributeChange,
  useAttributeValues,
  useBuyerJourneyIntercept,
  useLanguage,
  useSettings,
  useTotalAmount,
} from '@shopify/ui-extensions/checkout/preact';

// Shape of the merchant settings declared in shopify.extension.toml.
// Typing this gives you autocomplete on useSettings() instead of `unknown`.
//
// The index signature is REQUIRED: useSettings is constrained to
// `ExtensionSettings = Record<string, string | number | boolean | undefined>`,
// and a plain interface without it does not satisfy that constraint.
// Every field is optional because a merchant may not have filled it in yet.
interface LabSettings {
  [key: string]: string | number | boolean | undefined;
  free_shipping_threshold?: number;
  gift_note_label?: string;
}

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  return (
    <s-stack gap="base">
      <FreeShippingMeter />
      <GiftNote />
      <TermsGate />
    </s-stack>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LESSON 1 · READING checkout data.
//
// Hooks return plain values, not signals — the hook subscribes for you and
// re-renders on change. Add an item in another tab and this updates itself.
//
// `useSettings()` returns Partial<T>: every field can be undefined because a
// merchant may not have filled it in yet. Always supply a fallback. Treating
// settings as guaranteed is a top source of blank-extension bug reports.
// ───────────────────────────────────────────────────────────────────────────
function FreeShippingMeter() {
  const total = useTotalAmount();
  const {free_shipping_threshold: threshold} = useSettings<LabSettings>();
  const language = useLanguage();

  // Bail out cleanly when unconfigured. Rendering nothing is correct here —
  // checkout collapses the empty slot, no layout gap.
  if (!threshold || threshold <= 0) return null;

  const remaining = threshold - total.amount;
  const pct = Math.min(100, Math.round((total.amount / threshold) * 100));

  const money = (n: number) =>
    new Intl.NumberFormat(language.isoCode, {
      style: 'currency',
      currency: total.currencyCode,
    }).format(n);

  if (remaining <= 0) {
    return (
      <s-banner tone="success" heading="Free shipping unlocked">
        <s-text>Nice — your order qualifies for free shipping.</s-text>
      </s-banner>
    );
  }

  return (
    <s-banner tone="info" heading={`${money(remaining)} away from free shipping`}>
      <s-stack gap="small-200">
        <s-progress value={pct} max={100} />
        <s-text>Cart total: {money(total.amount)}</s-text>
      </s-stack>
    </s-banner>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LESSON 2 · WRITING data back.
//
// Extensions run in a sandboxed web worker and cannot mutate checkout
// directly. You *request* a change; checkout accepts or rejects it. Every
// apply*Change returns {type: 'success' | 'error'}.
//
// ALWAYS branch on that result. Ignoring it is the #1 real-world bug in
// checkout extensions: the buyer types a note, sees no error, and the note
// never reaches the order.
//
// Cart attributes are the standard channel for buyer-supplied text. They show
// up on the order in admin and in Order Printer.
// ───────────────────────────────────────────────────────────────────────────
function GiftNote() {
  const {gift_note_label} = useSettings<LabSettings>();
  const label = gift_note_label ?? 'Add a gift note';

  // Read the persisted value so the field survives a refresh or a step back.
  const [saved] = useAttributeValues(['gift_note']);
  const applyAttributeChange = useApplyAttributeChange();

  const [note, setNote] = useState(saved ?? '');
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  async function save(value: string) {
    setSaving(true);
    setError(undefined);

    const result = await applyAttributeChange({
      type: 'updateAttribute',
      key: 'gift_note',
      value,
    });

    setSaving(false);
    if (result.type === 'error') {
      setError(result.message ?? 'We could not save your note. Please retry.');
    }
  }

  return (
    <s-stack gap="small-200">
      <s-text-field
        label={label}
        value={note}
        error={error}
        // `change` fires on commit/blur — the right moment to persist.
        // Wiring this to `input` (every keystroke) would hammer the API and
        // can get your extension throttled.
        onChange={(event: Event) => {
          const value = (event.target as HTMLInputElement).value;
          setNote(value);
          void save(value);
        }}
      />
      {saving ? <s-text color="subdued">Saving…</s-text> : null}
    </s-stack>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LESSON 3 · BLOCKING the buyer.  Requires block_progress = true in the toml.
//
// `useBuyerJourneyIntercept` registers a gate checkout consults when the buyer
// tries to advance. Three rules that matter in production:
//
//   1. Honour `canBlockProgress`. It is false on flows you cannot gate (some
//      express/wallet checkouts). Blocking is simply unavailable there, so
//      degrade instead of assuming your gate always runs.
//   2. Give every error a `target` ('$.cart' anchors it to the cart) so
//      checkout can scroll to and highlight the problem.
//   3. Set buyer-visible state in `perform`, not in the intercept callback.
//      Intercept runs for every navigation attempt and must stay pure —
//      calling setState there causes render loops.
// ───────────────────────────────────────────────────────────────────────────
function TermsGate() {
  const [accepted, setAccepted] = useState(false);
  const [showError, setShowError] = useState(false);

  useBuyerJourneyIntercept(({canBlockProgress}) => {
    if (canBlockProgress && !accepted) {
      return {
        behavior: 'block',
        reason: 'Handling terms not accepted',
        // Runs after all interceptors resolve — the safe place for setState.
        perform: () => setShowError(true),
        errors: [
          {
            message: 'You must accept the handling terms before continuing.',
            target: '$.cart',
          },
        ],
      };
    }

    return {
      behavior: 'allow',
      perform: () => setShowError(false),
    };
  });

  return (
    // s-checkbox takes its text via the `label` PROP, not as children.
    // Polaris web components are strict about this: components built on
    // BaseElementProps reject children, while BaseElementPropsWithChildren
    // (s-text, s-banner, s-stack) accept them.
    <s-checkbox
      label="I understand these items are made to order and are non-refundable."
      checked={accepted}
      error={showError ? 'Please accept to continue.' : undefined}
      onChange={(event: Event) =>
        setAccepted((event.target as HTMLInputElement).checked)
      }
    />
  );
}
