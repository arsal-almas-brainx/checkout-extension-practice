import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
  ValidationError,
} from "../generated/api";

// Shape of the metafield JSON:
//   { "zips": ["10001", "75500", "SW1A*"], "message": "Sorry, we don't deliver to {zip}." }
// An entry ending in * is a PREFIX ("SW1A*" blocks SW1A 1AA, SW1A 2BB, …).
type Configuration = { zips?: string[]; message?: string };

const DEFAULT_MESSAGE = "Sorry, we don't deliver to {zip} yet. Please use a different address.";

// Buyers type "sw1a 1aa", "SW1A1AA", " 75500 " — compare a normalised form.
const normalise = (zip: string) => zip.replace(/\s+/g, "").toUpperCase();

export function isBlocked(zip: string, blocked: string[]): boolean {
  const z = normalise(zip);
  return blocked.some((entry) => {
    const e = normalise(entry);
    return e.endsWith("*") ? z.startsWith(e.slice(0, -1)) : z === e;
  });
}

export function cartValidationsGenerateRun(
  input: CartValidationsGenerateRunInput,
): CartValidationsGenerateRunResult {
  const raw = input.validation.metafield?.jsonValue;
  const config: Configuration = raw && typeof raw === "object" ? raw : {};
  const blocked = (config.zips ?? []).filter((z) => typeof z === "string" && z.trim());

  const errors: ValidationError[] = [];
  input.cart.deliveryGroups.forEach((group, i) => {
    const zip = group.deliveryAddress?.zip;
    if (zip && isBlocked(zip, blocked)) {
      errors.push({
        message: (config.message || DEFAULT_MESSAGE).replace("{zip}", zip.trim()),
        // Point at the ZIP field so checkout shows the error right under it.
        target: `$.cart.deliveryGroups[${i}].deliveryAddress.zip`,
      });
    }
  });

  return { operations: [{ validationAdd: { errors } }] };
}
