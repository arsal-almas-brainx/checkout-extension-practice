# Part 2 · Shopify Functions training (Lessons 10–17 + ZIP blocker)

Lessons 6 and 7 introduced Functions. This part covers every other Function
API you can run on a Plus dev store. **All of it is built, deployed and
active on `arsals-plus-store`.** Each lesson lists its code, how it was
switched on, how to see it working, and the traps hit along the way.

> **Plan rule:** a *custom* app that contains Functions only works on **Plus**
> stores (dev stores count). That's why this runs on arsals-plus-store and not
> on the Basic asma-dev-store.

## The loop you repeat for every Function

```text
1. shopify app generate extension --template <api> --flavor typescript --name <name>
2. Edit src/<target>.graphql      ← the input query: exactly the data you get
3. shopify app function typegen   ← regenerate generated/api.ts types
4. Edit src/<target>.ts           ← pure logic: input → { operations: [...] }
5. Write fixtures in tests/fixtures/*.json, run `npx vitest run`
6. Add the write_* scope to shopify.app.toml, `shopify app deploy`, approve
7. ACTIVATE it with an Admin GraphQL mutation (deployed ≠ active)
8. Test in a real checkout, then read the run logs in the Dev Dashboard
```

Template names used by the CLI: `discount`, `payment_customization`,
`cart_checkout_validation`, `cart_transform`, `fulfillment_constraints`,
`delivery_customization`, `validation_settings_ui` (admin settings UI).

Activation is done with `shopify app execute -s arsals-plus-store.myshopify.com
-q '<mutation>'`, using the app's own scopes.

| Lesson | Extension | Function API | Activated by | Scope |
|---|---|---|---|---|
| 10–11 | `discount-rules` | Discount | `discountAutomaticAppCreate`, `discountCodeAppCreate` | `write_discounts` |
| 12 | `payment-rules` | Payment customization | `paymentCustomizationCreate` | `write_payment_customizations` |
| 13 | all of the above | metafield config + input variables | (the `metafields:` input of each mutation) | — |
| 14 | `zip-blocker-settings` | admin UI extension `admin.settings.validation.render` | linked from the Function's toml | — |
| ZIP | `zip-blocker` | Cart & checkout validation | `validationCreate` | `write_validations` |
| 15 | `bundle-builder` | Cart transform | `cartTransformCreate` | `write_cart_transforms` |
| 16 | `fulfillment-rules` | Fulfillment constraints | `fulfillmentConstraintRuleCreate` | `write_fulfillment_constraint_rules` |
| 17 | — | debugging | `shopify app function run`, Dev Dashboard → Logs | — |

Tests: `npx vitest run` inside each Function folder. Total across the new
Functions: discount 10, payment 5, ZIP 6, bundle 3, fulfillment 3 (27, all
passing).

---

## Lesson 10 · Discount Function (automatic)

**Code:** `extensions/discount-rules/` (two targets, one shared `src/config.ts`)

- `cart.lines.discounts.generate.run` emits **product** and **order**
  discounts.
- `cart.delivery-options.discounts.generate.run` emits **shipping**
  discounts.

**What the "Training tiered discount" does:**

| Tier | Rule | Discount class |
|---|---|---|
| Bulk buy | any line with quantity ≥ 3 gets 10% off | PRODUCT |
| Spend | subtotal ≥ AED 300 gives 15% off the order | ORDER |
| Free shipping | subtotal ≥ AED 500 makes shipping free | SHIPPING |

**See it:** add 2 Lab Hoodies and 3 Lab Test Tees, then go to checkout. Add a
4th hoodie and choose Express to see the shipping discount.

**Traps learned:**

- **`Decimal` is a string both ways.** Input amounts arrive as `"120.0"`
  (use `Number()`), and output percentages must be strings too
  (`value: String(10)`). The generated types enforce this.
- **Currency.** Cart amounts are in the buyer's currency, while the config is
  in AED. Multiply thresholds by `presentmentCurrencyRate`.
- **The delivery target runs after the cart-lines target.** Its
  `subtotalAmount` already has the product and order discounts taken off.
  4 hoodies cost 720 but count as 550.80, so the 500 threshold is measured
  *after* discounts. Three hoodies (486) did **not** get free shipping.
- **Respect `discountClasses`.** Only emit operations for the classes the
  merchant enabled on that discount node.

## Lesson 11 · The same Function as a code (TRAIN20)

There's no new code, just a second **discount node** pointing at the same
Function, with its own metafield config:

```json
{ "label": "TRAIN20", "productPercent": 0, "orderMinSubtotal": 0, "orderPercent": 20, "freeShippingMinSubtotal": 0 }
```

Created with `discountCodeAppCreate`, using `discountClasses: [ORDER]`.

**Combinations lesson (both cases tested live with 3 tees plus TRAIN20):**

| TRAIN20 `combinesWith.orderDiscounts` | Result |
|---|---|
| `false` (first setup) | Only TRAIN20 applied: −15.00, total AED 60. The "buy 3+" discount disappeared. |
| `true` (now, via `discountCodeAppUpdate`) | Both applied: tees 75 → 67.50, then TRAIN20 takes 20% of 67.50 (−13.50), total AED 54 |

Why `false` dropped the product discount: the automatic discount is **one
discount node** with PRODUCT + ORDER + SHIPPING classes, so for combination
purposes it counts as an order discount too. TRAIN20 wouldn't combine with
order discounts, so Shopify could apply only one, and it kept the bigger
saving. **Rule:** a multi-class discount combines only if the other discount
accepts *every* class it has.

Note also that TRAIN20's 20% is taken from the subtotal **after** the
product discount (67.50, not 75).

## Lesson 12 · Payment customization

**Code:** `extensions/payment-rules/`, target `cart.payment-methods.transform.run`

| Situation | Operation |
|---|---|
| total > AED 500, or a PO Box address | `paymentMethodHide` on Cash on Delivery |
| otherwise | `paymentMethodRename` to "Cash on Delivery — pay the courier", then `paymentMethodMove` to index 0 |

- **Store setup:** Settings → Payments → Manual payment methods →
  **Cash on Delivery (COD)**.
- **Gotcha:** a Function can only act on methods the store *already* offers.
  It finds them by **name** (`paymentMethods { id name }`), so match loosely.
- Hiding wins: once a method is hidden, renaming or moving it is pointless.

## Lesson 13 · Configuration lives in metafields

Every new Function reads its settings from a JSON metafield **on its owner**,
in the `$app:` namespace, which is reserved for this app:

| Owner | Metafield |
|---|---|
| discount node | `$app:discount-rules / function-configuration` |
| payment customization | `$app:payment-rules / function-configuration` |
| validation | `$app:zip-blocker / blocked-zips` |
| fulfillment constraint rule | `$app:fulfillment-rules / function-configuration` (input variables) |

The metafield is set in the `metafields:` input of the activation mutation.
Change the JSON and the behaviour changes **without a deploy**. Every field
falls back to a default in code, so a missing metafield is never a crash.

**13b · Input variables** (`fulfillment-rules/shopify.extension.toml`):

```toml
input_variables = { namespace = "$app:fulfillment-rules", key = "function-configuration" }
```

The metafield JSON becomes the input query's `$variables`. This is the only
way merchant data can reach a **field argument** such as
`hasAnyTag(tags: $fragileTags)` or `locations(names: $locationNames)`. You
can't read product tags directly in a Function, only ask "has any of these?".
In API 2026-07+ this goes on each `[[extensions.targeting]]`; the old
extension-level `[extensions.input.variables]` is deprecated.

## Extra lesson · ZIP / postal code blocker (validation)

**Code:** `extensions/zip-blocker/`, target `cart.validations.generate.run`

- Reads `validation.metafield($app:zip-blocker/blocked-zips).jsonValue`:
  `{ "zips": ["75500","54000","10001","9410*","SW1A*","44000"], "message": "Sorry, we don't deliver to {zip} yet. …" }`
- Comparisons ignore spaces and letter case, and an entry ending in `*` is a
  **prefix** (`SW1A*` blocks `SW1A 1AA`).
- The error target is `$.cart.deliveryGroups[i].deliveryAddress.zip`, so the
  message appears **right under the postal code field**.

**Store setup for testing:**

- UAE addresses have no postal code field, so a **Pakistan** market was added.
- The market needed its own shipping option (Markets → Pakistan →
  Shipping → Add shipping option, AED 30).
- A delivery-profile zone alone was not enough: the market showed
  "Not shipping" and products showed as *sold out* until the market-level
  shipping option existed.

**See it:** switch the storefront to Pakistan, then use a Karachi address
with postal code 75500.

## Lesson 14 · Admin settings UI for a Function

**Code:** `extensions/zip-blocker-settings/` (Preact, target
`admin.settings.validation.render`), linked from `zip-blocker/shopify.extension.toml`:

```toml
[extensions.ui]
handle = "zip-blocker-settings"
```

It appears in **Settings → Checkout → Checkout rules → ZIP code blocker**.

1. On first open it creates the metafield **definition**
   (`metafieldDefinitionCreate`, owner `VALIDATION`, type `json`). The value
   can't be saved without it.
2. It renders a text area of ZIPs plus a message field inside
   `<s-function-settings>`.
3. On the admin Save bar it calls `shopify.applyMetafieldChange(...)`.

This was verified by adding `44000` in admin and reloading: it persisted.

## Lesson 15 · Cart transform (bundles)

**Code:** `extensions/bundle-builder/`, target `cart.transform.run`

- The kit product "Training Starter Kit" (AED 199) has a variant metafield
  `custom.bundle_components` (JSON):
  `[{variantId: tee, quantity: 1}, {variantId: hoodie, quantity: 1}, {variantId: sticker pack, quantity: 2}]`
- The Function emits `lineExpand`, and checkout shows the kit with
  "1 × Lab Test Tee, 1 × Lab Hoodie, 2 × Lab Sticker Pack".
- There's no `price` in the operation, so the buyer pays the kit price
  (AED 199, against AED 221 for the parts). Shopify splits it across the
  components in proportion to their prices.
- Quantities are **per kit**. Shopify multiplies them by the line quantity.
- Only **one** cart transform per app per store. `blockOnFailure: false`
  means a crash leaves the cart unchanged instead of blocking checkout.

## Lesson 16 · Fulfillment constraints

**Code:** `extensions/fulfillment-rules/`, target
`cart.fulfillment-constraints.generate.run`

- Products tagged `fragile` must ship from the **Fragile Goods Warehouse**
  (`deliverableLinesMustFulfillFromAdd`).
- If no fragile lines are in the cart, or the warehouse doesn't exist, it
  returns no constraint. Constraining to zero locations would make the item
  undeliverable.

**Store setup:**

- New location "Fragile Goods Warehouse" (`locationAdd`).
- The mug is stocked there (`inventoryActivate`, which needs the
  `@idempotent` directive in 2026-07).
- The warehouse is added to the UAE market's shipping option "Ships from".
  Without that, checkout said **"Shipping not available"**.

**Seen live:** mug + tee shows "Your order will arrive in 2 shipments". In
order #1003, the tee ships from Shop location and the mug from Fragile Goods
Warehouse.

## Lesson 17 · Debugging Functions

1. **Run locally**, with no store involved:
   `cd extensions/zip-blocker && shopify app function run --input input.json --export cart-validations-generate-run`
   This prints the input, the output and the **instruction count** (318K of
   the 11M limit for this Function).
2. **Fixture tests:** `npx vitest run` builds the Wasm and runs every
   `tests/fixtures/*.json` against it.
3. **Real runs:** Dev Dashboard → app → **Logs** → filter *Type is
   Function*. Each run shows the target, the input (STDIN), the output, and
   the instruction count against the limit.
   - Buyer data like the ZIP shows as `[REDACTED]` unless the app has
     protected customer data access.
4. **Replay:** `shopify app function replay --log <id>` re-runs a real run's
   input against your *local* code. It needs logs captured by `shopify app dev`.
   After using dev, run `shopify app dev clean`, or the dev preview overrides
   the released version.

## Store data created for this training

| What | Detail |
|---|---|
| Products | Lab Hoodie (AED 180), Lab Ceramic Mug (AED 120, tag `fragile`), Training Starter Kit (AED 199, tag `bundle`, with the `bundle_components` metafield) |
| Location | Fragile Goods Warehouse (Dubai), stocking the mug |
| Market | Pakistan, with a Standard shipping option (AED 30) |
| Payments | Cash on Delivery (COD) manual method |
| Discounts | "Training tiered discount" (automatic), "TRAIN20 code" |
| Rules | ZIP code blocker, Payment rules (Lesson 12), Bundle builder, Fulfillment rule |
| Test order | #1003 (mug + tee, COD), split across 2 locations |
