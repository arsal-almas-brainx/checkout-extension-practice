# Lesson 7 · Delivery Customization Function

**What it does:** hides, renames, and reorders shipping options at checkout.
Here: hide express shipping for PO-Box-ish/remote addresses, rename carrier
codes into human language, and float the cheapest option to the top.

**Why this is the highest-ROI function type.** Shipping options come out of
carriers with names like `USPS_PRIORITY_MAIL_2DAY` and arrive in whatever order
the rate call returned. Buyers read the list top-down and bounce when it's
confusing. Renaming and reordering is a few lines of code and moves conversion.

## Scaffold it

```bash
shopify app generate extension
```

Pick **Delivery customization** → **JavaScript**. Name it `delivery-rules`.
Confirm the `target` the CLI wrote is `cart.delivery-options.transform.run`.

## Wire in the lesson code

```bash
cd "/Users/brainxshopifydev/Desktop/Checkout Extenions"
cp lessons/07-delivery-customization/input.graphql  extensions/delivery-rules/src/
cp lessons/07-delivery-customization/delivery.ts    extensions/delivery-rules/src/
cd extensions/delivery-rules && shopify app function typegen
```

Keep whatever export name the CLI generated (`cartDeliveryOptionsTransformRun`).

## Turn it on

Deploy, then **Settings → Shipping and delivery → Checkout customizations →
Add customization**. Like validation functions, it is inert until activated.

## The one gotcha

You cannot hide *every* option. If your rules would leave a delivery group with
nothing, Shopify ignores the hide operations for that group rather than
producing a checkout the buyer can't complete. Design for that: always leave a
fallback. The code below does this explicitly — read the `keepAtLeastOne` note.
