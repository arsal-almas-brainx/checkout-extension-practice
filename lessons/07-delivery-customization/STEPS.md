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
cp lessons/07-delivery-customization/input.graphql  extensions/delivery-rules/src/cart_delivery_options_transform_run.graphql
cp lessons/07-delivery-customization/delivery.ts    extensions/delivery-rules/src/cart_delivery_options_transform_run.ts
cd extensions/delivery-rules && shopify app function typegen
```

Keep whatever export name the CLI generated (`cartDeliveryOptionsTransformRun`).

## Turn it on

Like validation functions, it is inert until activated, and activation is a
mutation (verified 2026-11): add `write_delivery_customizations` to the app's
scopes, deploy, approve the update in the store admin, then:

```bash
shopify app execute -s <store>.myshopify.com --version 2026-07 -q '
mutation { deliveryCustomizationCreate(deliveryCustomization: {
  functionHandle: "delivery-rules", title: "Delivery rules", enabled: true}) {
  deliveryCustomization { id enabled } userErrors { field message } } }'
```

Afterwards it shows under **Settings → Shipping and delivery** as
"Delivery rules by <your app>".

**To see it work** your store needs rates with carrier-style names. A fresh
store usually has one generic rate, so nothing visibly changes. Add e.g.
"UPS Ground" (15) and "USPS Priority Mail 2-Day" (40) in the market's shipping
options. Then a street address shows "Standard — 3 to 5 days" first and
"Express — arrives in 2 days" last, and a PO Box address hides Express.

The finished, tested version lives in `extensions/delivery-rules/`.

## The one gotcha

You cannot hide *every* option. If your rules would leave a delivery group with
nothing, Shopify ignores the hide operations for that group rather than
producing a checkout the buyer can't complete. Design for that: always leave a
fallback. The code below does this explicitly — read the `keepAtLeastOne` note.
