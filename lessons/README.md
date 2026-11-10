# Why Functions live here and not in `extensions/`

The `extensions/` directory is scanned by the Shopify CLI on every
`shopify app dev`. A half-finished extension folder in there — one missing a
valid `shopify.extension.toml` — breaks the whole dev command, including the
UI extension that already works.

So these two Function lessons are staged here instead. For each one you:

1. Let the CLI scaffold the extension (it writes the `shopify.extension.toml`,
   the `package.json`, and the `generated/api.d.ts` types for you).
2. Copy the logic and the input query from this folder over the placeholders.

**This split is deliberate.** Function *wiring* is the most version-volatile
part of the whole platform — target names and output shapes have changed
across recent API versions (the validation target moved from
`cart_checkout_validation.run` to `cart.validations.generate.run`, and the
return value moved from a bare `errors` array to an `operations` array).
Hand-copying a `.toml` from any tutorial, including this one, is how you end
up debugging a build error that has nothing to do with your logic.

The CLI reads the current spec from Shopify and always emits a correct
manifest. Let it own the wiring; you own the logic. The logic is the part
that's actually yours, and it's what these files contain.
