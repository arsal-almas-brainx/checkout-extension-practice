# Checkout Extensions — Hands-On Lab

A working project for learning Shopify checkout extensions, built and
type-verified against **API version 2026-07**.

Your environment, already checked: Node v24.14.1 · npm 11.11.0 ·
Shopify CLI 3.92.1 · logged in. No Rust needed — the Functions here are
TypeScript.

---

## First: corrections to the Sidekick notes

The structure of those notes was right. Several specifics were stale, and two
would have cost you an afternoon.

| Sidekick said | Reality (2026-07) |
|---|---|
| `shopify app create node` | **`shopify app init`**. The old command is gone. For extension-only work: `shopify app init --template none`. |
| `extension("purchase.checkout.block.render", (root, api) => { root.createComponent(Banner, …) })` | **That API is retired.** Since 2025-10 it's Preact + Polaris web components: `render(<Extension/>, document.body)` with `<s-banner>`. See `extensions/checkout-ui-lab/src/Checkout.tsx`. |
| `purchase.order-status.block.render` | Order Status moved to **Customer Account** extensions: `customer-account.order-status.block.render`. Different surface, different package import. |
| Functions "written in JavaScript/TypeScript" | True, but **Rust is Shopify's recommended language** for production Functions. JS/TS compiles via Javy and is perfect for learning. |
| — | **Function targets and return shapes changed.** Validation is now `cart.validations.generate.run` returning `{operations: [{validationAdd: {errors}}]}` — not the older `cart_checkout_validation.run` with a bare `errors` array. |
| — | **Your compiled UI extension bundle must stay under 64 KB.** Enforced at deploy. |

Right in the notes: your Custom/Plus plan unlocks all of this; Functions in a
*custom* app do require Plus; the Checkout Branding API and the AI Toolkit
(`shopify.dev/docs/apps/build/ai-toolkit`) are both real.

---

## The one mental model worth having

Everything below follows from this:

**A checkout extension is a guest in someone else's house.** It runs in a
sandboxed web worker, off the main thread, with no DOM access to the page
around it. It cannot mutate checkout — it can only *request* changes and be
told yes or no. That single constraint explains the whole API shape:

- Why you read data through hooks instead of a global — the host pushes
  updates in.
- Why every write is `await`ed and returns `{type: 'success' | 'error'}`.
- Why blocking the buyer needs a declared capability and can still be denied.
- Why Functions get zero network access — they must be fast and deterministic.

**And the pairing that matters most:** a UI extension *explains* a rule; a
Function *enforces* it. Client-side validation is UX and is trivially bypassed.
If a rule has money or legal weight behind it, it belongs in a Function.

---

## Step 1 · Link this project to your store

The code is already written. This step is yours because it needs an
interactive org/store pick, which can't be automated.

**1a. Create the app config.** `shopify app dev` will NOT do this for you — it
errors with "Couldn't find an app toml file" if the config doesn't exist yet.
Link first:

```bash
cd "/Users/brainxshopifydev/Desktop/Checkout Extenions"
shopify app config link
```

Pick your organization, then choose **Create a new app** (or select an existing
one). This writes `shopify.app.toml`.

**1b. Start the dev session.**

```bash
shopify app dev --use-localhost
```

It stays running and hot-reloads on every save, and prints a preview URL.

**Why `--use-localhost`.** By default the CLI opens a Cloudflare tunnel over
QUIC (UDP port 7844). Plenty of office and ISP networks drop that, and you get:

```
Could not start Cloudflare tunnel: Failed to create new quic connection
error="failed to dial to edge with quic: timeout: no recent network activity"
```

That is a blocked-UDP problem, not a project problem. `--use-localhost` skips
the tunnel and serves from localhost instead. The tradeoff is that Shopify's
servers can no longer reach *into* your app — so webhooks and anything else
Shopify invokes directly won't work. **This app has no backend and no webhooks,
so nothing is lost.** Checkout UI extension bundles load in the browser on this
machine, which can reach localhost fine.

First run generates a local HTTPS certificate into `.shopify/`. Add
`--localhost-port 3457` if the default port is busy.

**If the certificate step fails to download mkcert.** On a restricted network
you'll see:

```
Failed to download mkcert-v1.4.4-darwin-arm64: ... reason: read ECONNRESET
```

GitHub's release-download CDN is blocked. Install mkcert from Homebrew instead
— the CLI looks for it on PATH before it tries downloading:

```bash
brew install mkcert
```

(Already done in this project, along with pre-placing `.shopify/mkcert-LICENSE`
so the CLI doesn't reach for GitHub again.)

The CLI resolves mkcert in this order, which is useful to know when it
misbehaves:

1. `$SHOPIFY_CLI_MKCERT_BINARY` — explicit override, point it at any binary
2. `.shopify/mkcert` inside the project
3. **`which mkcert`** — what the Homebrew install satisfies
4. download from GitHub — the step that fails on restricted networks

It then runs `mkcert -install … localhost`, which may ask for your macOS
password the first time so it can trust the local CA. That's expected.

**Escape hatch:** the CLI skips mkcert entirely when both
`.shopify/localhost.pem` and `.shopify/localhost-key.pem` already exist. If you
ever need to sidestep the whole flow, generate them yourself:

```bash
cd "/Users/brainxshopifydev/Desktop/Checkout Extenions/.shopify"
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost
```

**Speed tip.** Jump straight into a checkout with a prefilled cart instead of
clicking through the storefront every reload:

```bash
shopify app dev --use-localhost --checkout-cart-url "/cart/VARIANT_ID:1"
```

Get a variant ID from any product in the dev-store admin (**Products →** pick
one **→ Variants**, the numeric ID at the end of the URL).

## Step 2 · Make the extension appear

`purchase.checkout.block.render` is a **dynamic** target: it renders nowhere
until you place it.

1. In the dev-store admin: **Settings → Checkout → Customize**
2. Click **Apps** in the left sidebar → **Checkout UI Lab**
3. Drag it onto the Information step
4. In its settings panel, set **Free shipping threshold** to something your
   test cart can straddle — e.g. `100`
5. **Save**

The free-shipping meter, gift-note field, and terms checkbox all appear. The
delivery note (Lesson 4) and Thank You block (Lesson 5) are **static** targets
— they show up on their own, no placement needed.

## Step 3 · Read the code, in this order

| # | File | Teaches |
|---|---|---|
| 1 | `extensions/checkout-ui-lab/src/Checkout.tsx` → `FreeShippingMeter` | The three imports and why each exists. Reading data. Merchant settings. |
| 2 | same file → `GiftNote` | Writing back. Why you must check `result.type`. |
| 3 | same file → `TermsGate` | Blocking the buyer. `canBlockProgress`. Why setState goes in `perform`. |
| 4 | `src/DeliveryNotes.tsx` | Static vs dynamic targets. The `selectedDeliveryOption` handle trap. |
| 5 | `src/ThankYou.tsx` | Post-purchase. `useApi` + `useSubscription`. Why checkout hooks are gone here. |
| 6 | `lessons/06-validation-function/` | Server-side enforcement. Pure `(input) => output`. |
| 7 | `lessons/07-delivery-customization/` | Operations model. Renaming and reordering shipping. |

`shopify.extension.toml` is commented too — capabilities, targets, and the
merchant settings schema.

## Step 4 · Verify your changes

```bash
cd extensions/checkout-ui-lab
npx tsc --noEmit          # already clean; keep it that way
```

The types are unusually load-bearing here. They caught six real mistakes while
this lab was being built: `s-checkbox` takes `label` as a prop and rejects
children; `s-text` uses `color="subdued"` not `tone`; `s-banner` has no
`caution` tone (it's `warning`); `useSettings` needs an index signature; and
`selectedDeliveryOption` is a bare `{handle}` reference with no title on it.
Typecheck before you click through checkout — it's far faster.

## Step 5 · The Functions (Lessons 6 & 7)

Follow `lessons/README.md` first — it explains why Function wiring is scaffolded
by the CLI rather than copied from this repo. Short version: target names and
output shapes are the most version-volatile part of the platform, the CLI always
emits a correct manifest, and you supply the logic.

Then work through `lessons/06-validation-function/STEPS.md` and
`lessons/07-delivery-customization/STEPS.md`.

Two things that trip up nearly everyone:

- **`shopify app function typegen`** after every `input.graphql` edit, or your
  `input` stays `any`.
- **Deployed ≠ active.** A validation Function does nothing until you add it
  under Settings → Checkout → Checkout rules. A delivery Function needs
  Settings → Shipping and delivery → Checkout customizations. This is the
  single most common "my function isn't running" cause.

## Step 6 · Ship it

```bash
shopify app deploy
```

---

## Where to go after this

Roughly in order of payoff:

1. **Checkout Branding API** — colors, type, corner radius across checkout, via
   GraphQL. The editor can't reach most of it. Highest visual impact per hour.
2. **Discount Functions** — `cart.lines.discounts.generate.run`. Any promo logic
   the native discount engine can't express.
3. **Payment customization** — hide/rename payment methods. Same operations
   model as Lesson 7, so it's a short hop.
4. **Customer Account extensions** — where Order Status now lives.
5. **Unit testing** — `@shopify/ui-extensions-tester` (2026-04+) tests
   extensions without a browser.
6. **Web pixel extensions** — the correct home for analytics that used to sit
   in "Additional scripts".

## Live docs in this folder

`.mcp.json` registers Shopify's official docs MCP server (verified working,
v1.14.5). Next time you open Claude Code here it gives me `search_docs_chunks`
plus `validate_component_codeblocks` and `validate_graphql_codeblocks` — which
check `s-*` component props and GraphQL input queries against the real current
schema. Worth using before you trust any snippet, including the ones here.
