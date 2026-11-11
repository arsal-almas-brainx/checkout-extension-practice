import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState } from "preact/hooks";

// Must match the metafield the zip-blocker Function's input query reads.
const NAMESPACE = "$app:zip-blocker";
const KEY = "blocked-zips";
const DEFAULT_MESSAGE = "Sorry, we don't deliver to {zip} yet. Please use a different address.";

export default async () => {
  // A metafield DEFINITION must exist before the admin can save the value.
  // Create it once, the first time any merchant opens this screen.
  if (!(await getMetafieldDefinition())) await createMetafieldDefinition();

  // `validation` is undefined while CREATING a new rule; set when editing.
  const saved = shopify.data.validation?.metafields?.find((m) => m.key === KEY);
  const config = JSON.parse(saved?.value ?? "{}");

  render(<Settings initialZips={config.zips ?? []} initialMessage={config.message ?? ""} />, document.body);
};

// "10001, 75500\nSW1A*" → ["10001", "75500", "SW1A*"]
const parseZips = (text) =>
  text
    .split(/[\n,]/)
    .map((z) => z.trim())
    .filter(Boolean);

function Settings({ initialZips, initialMessage }) {
  const [zipsText, setZipsText] = useState(initialZips.join("\n"));
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const result = await shopify.applyMetafieldChange({
      type: "updateMetafield",
      namespace: NAMESPACE,
      key: KEY,
      value: JSON.stringify({ zips: parseZips(zipsText), message: message.trim() }),
      valueType: "json",
    });
    if (result.type === "error") setError(result.message);
  };

  const count = parseZips(zipsText).length;

  return (
    // The admin shows its own Save bar; onSubmit fires when it is clicked.
    <s-function-settings onSubmit={(event) => event.waitUntil(save())}>
      <s-stack gap="base">
        {error && (
          <s-banner heading="Could not save" tone="critical">
            {error}
          </s-banner>
        )}
        <s-text-area
          label="Blocked ZIP / postal codes"
          name="zips"
          rows={6}
          value={zipsText}
          details={`One per line or comma-separated. End with * to block a prefix (SW1A* blocks SW1A 1AA). ${count} code(s) blocked.`}
          onInput={(event) => setZipsText(event.currentTarget.value)}
        />
        <s-text-field
          label="Message shown to the buyer"
          name="message"
          value={message}
          placeholder={DEFAULT_MESSAGE}
          details="{zip} is replaced with the code the buyer typed."
          onInput={(event) => setMessage(event.currentTarget.value)}
        />
      </s-stack>
    </s-function-settings>
  );
}

async function getMetafieldDefinition() {
  const result = await shopify.query(
    `#graphql
    query GetDefinition($namespace: String!, $key: String!) {
      metafieldDefinitions(first: 1, ownerType: VALIDATION, namespace: $namespace, key: $key) {
        nodes { id }
      }
    }`,
    { variables: { namespace: NAMESPACE, key: KEY } },
  );
  // shopify.query() returns `data: unknown` — it can't know your query's shape.
  return /** @type {any} */ (result)?.data?.metafieldDefinitions?.nodes?.[0];
}

async function createMetafieldDefinition() {
  const result = await shopify.query(
    `#graphql
    mutation CreateDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { message }
      }
    }`,
    {
      variables: {
        definition: {
          name: "Blocked ZIP codes",
          namespace: NAMESPACE,
          key: KEY,
          ownerType: "VALIDATION",
          type: "json",
          access: { admin: "MERCHANT_READ_WRITE" },
        },
      },
    },
  );
  const errors = /** @type {any} */ (result)?.data?.metafieldDefinitionCreate?.userErrors ?? [];
  if (errors.length) throw new Error(errors.map((e) => e.message).join(", "));
}
