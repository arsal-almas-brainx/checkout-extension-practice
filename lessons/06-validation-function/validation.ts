// ═══════════════════════════════════════════════════════════════════════════
// LESSON 6 · Cart & Checkout Validation Function
// target: cart.validations.generate.run
//
// The whole contract of a Shopify Function:
//
//     (input) => output          // pure, synchronous, no I/O
//
// Things you CANNOT do in here, by design:
//   · no fetch / no network            · no admin API calls
//   · no async / await                 · no Date.now(), no Math.random()
//   · no reading files                 · no console-based side effects
//
// It compiles to WebAssembly and runs inside Shopify on every checkout, under
// a hard instruction budget. That's why it's fast and unbypassable — and why
// all the data it needs has to arrive through input.graphql.
//
// EXPORT NAME: it must match the target. For `cart.validations.generate.run`
// that is `cartValidationsGenerateRun`. The CLI generates the Wasm export from
// the target in your toml, so a mismatched name builds fine and then silently
// never runs. Whatever name the CLI put in the generated entry file, keep it.
// ═══════════════════════════════════════════════════════════════════════════

// These types come from `shopify app function typegen`, which reads
// input.graphql. Run typegen before you trust autocomplete here.
import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
} from '../generated/api';

/** Normalises an address line so "P.O. Box", "po box", "POBox" all match. */
function isPoBox(line: string): boolean {
  const normalized = line.toLowerCase().replace(/[.\s-]/g, '');
  return normalized.includes('pobox') || normalized.includes('postofficebox');
}

export function cartValidationsGenerateRun(
  input: CartValidationsGenerateRunInput,
): CartValidationsGenerateRunResult {
  const errors: {message: string; target: string}[] = [];

  // ── Rule 1 · no PO Box delivery addresses ────────────────────────────────
  // `target` is a JSONPath into the checkout. It is what lets checkout scroll
  // to and highlight the offending field instead of showing a floating error.
  // Note the INDEX in the path — it must point at the group that actually
  // failed, which is why we track `index` rather than hardcoding [0].
  input.cart.deliveryGroups.forEach((group, index) => {
    const address = group.deliveryAddress;
    if (!address) return;

    const line1 = address.address1 ?? '';
    const line2 = address.address2 ?? '';

    if (isPoBox(line1) || isPoBox(line2)) {
      errors.push({
        message:
          'We can’t deliver to a PO Box. Please enter a street address.',
        target: `$.cart.deliveryGroups[${index}].deliveryAddress.address1`,
      });
    }
  });

  // ── Rule 2 · wholesale items have a minimum quantity ─────────────────────
  for (const line of input.cart.lines) {
    // The input query used an inline fragment on ProductVariant, so the
    // merchandise union needs narrowing before you can touch `product`.
    // Checking __typename is the safe way; blind casts here are how you get
    // a runtime failure that only shows up on carts containing gift cards.
    if (line.merchandise.__typename !== 'ProductVariant') continue;

    const product = line.merchandise.product;
    if (product.isWholesale?.value !== 'true') continue;

    // Metafield values are ALWAYS strings, even numeric ones. Parse, and
    // guard the parse — a merchant typo like "12 units" would otherwise make
    // `minimum` NaN, and every comparison against NaN is false, silently
    // disabling your rule.
    const minimum = Number.parseInt(product.minimumQuantity?.value ?? '', 10);
    if (!Number.isFinite(minimum) || minimum <= 0) continue;

    if (line.quantity < minimum) {
      errors.push({
        message: `${line.merchandise.title} is wholesale only — minimum order is ${minimum} units.`,
        target: '$.cart',
      });
    }
  }

  // ── Return shape ─────────────────────────────────────────────────────────
  // Current API wraps errors in an `operations` array. Older tutorials return
  // a bare `{ errors }` — that shape is from the previous version and will not
  // validate against `cart.validations.generate.run`.
  //
  // Returning an empty errors array is the correct "all good" response.
  // Returning `{operations: []}` also works, but being explicit reads better
  // and makes the intent obvious when you revisit this in six months.
  return {
    operations: [
      {
        validationAdd: {errors},
      },
    ],
  };
}
