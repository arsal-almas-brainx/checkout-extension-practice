// ═══════════════════════════════════════════════════════════════════════════
// LESSON 8  ·  target: purchase.checkout.cart-line-list.render-after
//
// A product upsell — the most common "real" checkout extension. It combines
// three APIs you have not used yet:
//
//   1. `query` (Storefront API)  — read catalogue data that checkout itself
//      does not expose. Needs `api_access = true` in the toml. The token is
//      prefetched for you and carries read-only *unauthenticated_* scopes
//      (products, collections, tags...), so no app scopes are required.
//   2. `useApplyCartLinesChange` — ask checkout to add a line. Like every
//      apply*Change, it can be rejected: branch on the result.
//   3. `useInstructions`        — checkout tells you up front whether a
//      change is even allowed (e.g. draft-order checkouts lock the cart).
//      Check it and hide the offer instead of letting the click fail.
// ═══════════════════════════════════════════════════════════════════════════
import '@shopify/ui-extensions/preact';
import type {} from '@shopify/ui-extensions/purchase.checkout.cart-line-list.render-after';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {
  useApi,
  useApplyCartLinesChange,
  useCartLines,
  useInstructions,
  useLanguage,
  useLocalizationCountry,
} from '@shopify/ui-extensions/checkout/preact';

export default function extension() {
  render(<Extension />, document.body);
}

// Type the GraphQL response yourself — `query<Data>` does not generate types.
interface Variant {
  id: string;
  availableForSale: boolean;
  price: {amount: string; currencyCode: string};
}

interface Product {
  id: string;
  title: string;
  featuredImage: {url: string; altText: string | null} | null;
  variants: {nodes: Variant[]};
}

interface ProductsQuery {
  products: {nodes: Product[]};
}

// Keep queries small: checkout is performance-sensitive, and every field you
// request is latency the buyer waits through.
//
// ⚠️ `@inContext(country:)` is what makes prices come back in the BUYER'S
// market currency. Without it the Storefront API answers in the shop's
// default currency, so a Pakistani checkout in PKR shows "US$7.68" next to
// "Rs 2,200" — a real bug this lesson hit on its first test run.
const PRODUCTS_QUERY = `#graphql
  query UpsellProducts($first: Int!, $country: CountryCode)
  @inContext(country: $country) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        id
        title
        featuredImage { url altText }
        variants(first: 1) {
          nodes { id availableForSale price { amount currencyCode } }
        }
      }
    }
  }
`;

function Extension() {
  const {query} = useApi<'purchase.checkout.cart-line-list.render-after'>();
  const cartLines = useCartLines();
  const instructions = useInstructions();
  const applyCartLinesChange = useApplyCartLinesChange();
  const language = useLanguage();
  const country = useLocalizationCountry()?.isoCode;

  const [products, setProducts] = useState<Product[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Fetch once on mount. Do NOT put `query` in a render path without an
  // effect — it would refetch on every cart change.
  // Refetch when the buyer's country changes (they edit their address), since
  // that can move them to a different market and currency.
  useEffect(() => {
    query<ProductsQuery>(PRODUCTS_QUERY, {variables: {first: 10, country}})
      .then(({data, errors}) => {
        if (errors?.length) console.error('Upsell query failed', errors);
        setProducts(data?.products.nodes ?? []);
      })
      .catch((err) => {
        console.error('Upsell query failed', err);
        setProducts([]);
      });
  }, [query, country]);

  // Pick the first in-stock product the buyer does NOT already have.
  // Compare PRODUCT ids, not variant ids: offering "size M" of the shirt that
  // is already in the cart as "size L" is not an upsell, it's a duplicate.
  // Recomputed on every render, so adding the offer swaps in the next one.
  const productsInCart = new Set(
    cartLines.map((line) => line.merchandise.product.id),
  );
  const offer = products
    ?.map((product) => ({product, variant: product.variants.nodes[0]}))
    .find(
      ({product, variant}) =>
        variant && variant.availableForSale && !productsInCart.has(product.id),
    );

  if (!instructions.lines.canAddCartLine) return null;
  if (products === null) return <s-skeleton-paragraph />;
  if (!offer) return null;

  const {product, variant} = offer;
  const price = new Intl.NumberFormat(language.isoCode, {
    style: 'currency',
    currency: variant.price.currencyCode,
  }).format(Number(variant.price.amount));

  async function add() {
    setAdding(true);
    setError(undefined);

    const result = await applyCartLinesChange({
      type: 'addCartLine',
      merchandiseId: variant.id,
      quantity: 1,
    });

    setAdding(false);
    if (result.type === 'error') {
      setError(result.message ?? 'We could not add this item. Please retry.');
    }
  }

  return (
    <s-stack gap="small-200">
      <s-divider />
      <s-heading>You might also like</s-heading>
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-product-thumbnail
          src={product.featuredImage?.url ?? ''}
          alt={product.featuredImage?.altText ?? product.title}
        />
        <s-stack gap="none">
          <s-text>{product.title}</s-text>
          <s-text color="subdued">{price}</s-text>
        </s-stack>
        <s-button
          variant="secondary"
          loading={adding}
          accessibilityLabel={`Add ${product.title} to your order`}
          onClick={() => void add()}
        >
          Add
        </s-button>
      </s-stack>
      {error ? (
        <s-banner tone="critical">
          <s-text>{error}</s-text>
        </s-banner>
      ) : null}
    </s-stack>
  );
}
