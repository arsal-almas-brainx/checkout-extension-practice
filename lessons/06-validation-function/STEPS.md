# Lesson 6 · Cart & Checkout Validation Function

**What it does:** blocks checkout when the cart breaks a rule you define.
Here: no PO Box addresses, and a minimum order quantity for wholesale items.

**Why a Function and not the UI extension from Lesson 3?**
`useBuyerJourneyIntercept` runs in the browser. It is a *convenience* — good UX,
trivially bypassed, and it does not run at all for orders created through the
API, draft orders, or some express wallet flows. A validation Function runs
server-side inside Shopify on every checkout. If a rule actually matters,
it belongs in a Function. Use the UI extension to *explain* the rule and the
Function to *enforce* it. That pairing is the real pattern.

## Scaffold it

```bash
shopify app generate extension --template cart_checkout_validation --name order-rules
```

If that template flag is rejected, run `shopify app generate extension` with no
flags and pick **Cart and checkout validation** from the list, then choose
**JavaScript**. Name it `order-rules`.

The CLI creates `extensions/order-rules/` with a correct `shopify.extension.toml`.
**Do not edit that file.** Note the `target` it wrote — it should be
`cart.validations.generate.run`.

## Wire in the lesson code

```bash
cd "/Users/brainxshopifydev/Desktop/Checkout Extenions"
cp lessons/06-validation-function/input.graphql   extensions/order-rules/src/
cp lessons/06-validation-function/validation.ts   extensions/order-rules/src/
```

Then point the toml's `input_query` at `src/input.graphql` if it isn't already,
and make the file the CLI generated re-export the lesson logic — or just paste
`validation.ts`'s body into the generated entry file, keeping the **export name
the CLI generated** (it must match the target, e.g. `cartValidationsGenerateRun`).

## Generate types, then build

```bash
cd extensions/order-rules
shopify app function typegen     # reads input.graphql -> generated/api.d.ts
cd ../.. && shopify app build
```

`typegen` is the step people skip and then wonder why `input.cart` is `any`.
Run it again every time you change `input.graphql`.

## Test it without touching checkout

```bash
cd extensions/order-rules
shopify app function run          # feed it JSON on stdin, see the output
```

This runs the compiled Wasm locally. It is far faster than clicking through
checkout, and it's how you should iterate.

## Turn it on

A deployed validation Function does nothing until it's activated:
**Settings → Checkout → Checkout rules → Add rule**, then pick your function.
Forgetting this step is the most common "my function doesn't work" report.
