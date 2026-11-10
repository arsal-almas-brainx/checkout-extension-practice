import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/Upsell.tsx' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.cart-line-list.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}
