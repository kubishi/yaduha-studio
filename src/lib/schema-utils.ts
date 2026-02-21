/**
 * Schema utility functions for rendering Pydantic JSON schemas as interactive forms.
 * Ported from sentences-frontend/src/services/schemaUtils.js.
 */

export interface JsonSchema {
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  anyOf?: JsonSchema[];
  title?: string;
  description?: string;
  default?: unknown;
  [key: string]: unknown;
}

export type SchemaClassification =
  | "enum"
  | "boolean"
  | "string"
  | "object"
  | "union"
  | "optional"
  | "unknown";

export interface UnionVariant {
  name: string;
  schema: JsonSchema;
}

/**
 * Resolve a $ref path (e.g. "#/$defs/Pronoun") against the root schema.
 */
export function resolveRef(
  ref: string,
  rootSchema: JsonSchema
): JsonSchema | null {
  const path = ref.replace("#/", "").split("/");
  let result: unknown = rootSchema;
  for (const segment of path) {
    result = (result as Record<string, unknown>)?.[segment];
  }
  return (result as JsonSchema) || null;
}

/**
 * Resolve a schema node: if it has $ref, resolve it and merge siblings.
 */
export function resolveSchema(
  schema: JsonSchema,
  rootSchema: JsonSchema
): JsonSchema {
  if (!schema) return schema;
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, rootSchema);
    const { $ref: _, ...rest } = schema;
    return { ...resolved, ...rest };
  }
  return schema;
}

/**
 * Extract non-null union variants from an anyOf array.
 */
export function getUnionVariants(
  anyOfArray: JsonSchema[],
  rootSchema: JsonSchema
): UnionVariant[] {
  return anyOfArray
    .filter((item) => item.type !== "null")
    .map((item) => {
      const resolved = resolveSchema(item, rootSchema);
      return { name: resolved?.title || "Unknown", schema: resolved };
    });
}

/**
 * Classify a schema node into a rendering type.
 */
export function classifySchema(
  schema: JsonSchema,
  rootSchema: JsonSchema
): SchemaClassification {
  if (!schema) return "unknown";

  const resolved = resolveSchema(schema, rootSchema);

  if (resolved.anyOf) {
    const nonNull = resolved.anyOf.filter((item) => item.type !== "null");
    const hasNull = resolved.anyOf.some((item) => item.type === "null");

    if (hasNull && nonNull.length === 1) return "optional";
    if (nonNull.length > 1) return "union";
    if (nonNull.length === 1) return classifySchema(nonNull[0], rootSchema);
  }

  if (resolved.enum) return "enum";
  if (resolved.type === "boolean") return "boolean";
  if (resolved.type === "object" && resolved.properties) return "object";
  if (resolved.type === "string") return "string";

  return "unknown";
}

/**
 * Build a default/empty value for a schema node.
 */
export function buildDefaultValue(
  schema: JsonSchema,
  rootSchema: JsonSchema
): unknown {
  if (!schema) return null;

  const resolved = resolveSchema(schema, rootSchema);

  if (resolved.anyOf) {
    const nonNull = resolved.anyOf.filter((item) => item.type !== "null");
    const hasNull = resolved.anyOf.some((item) => item.type === "null");

    if (hasNull && nonNull.length === 1) return null;
    if (nonNull.length >= 1) return buildDefaultValue(nonNull[0], rootSchema);
  }

  if (resolved.type === "boolean") return false;
  if (resolved.enum) return resolved.enum[0] || "";
  if (resolved.type === "string") return "";

  if (resolved.type === "object" && resolved.properties) {
    const obj: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(resolved.properties)) {
      obj[key] = buildDefaultValue(propSchema, rootSchema);
    }
    return obj;
  }

  return null;
}

/**
 * Detect which union variant a value currently matches.
 */
export function detectVariant(
  value: unknown,
  variants: UnionVariant[]
): string {
  if (value == null) return variants[0]?.name ?? "";

  if (typeof value === "string") {
    for (const variant of variants) {
      if (variant.schema?.enum?.includes(value)) return variant.name;
    }
    return variants[0]?.name ?? "";
  }

  if (typeof value !== "object") return variants[0]?.name ?? "";

  const valueKeys = new Set(Object.keys(value as Record<string, unknown>));
  let best = variants[0]?.name ?? "";
  let bestScore = -Infinity;

  for (const variant of variants) {
    const props = Object.keys(variant.schema?.properties || {});
    const matchCount = props.filter((p) => valueKeys.has(p)).length;
    const extraCount = [...valueKeys].filter(
      (p) => !props.includes(p)
    ).length;
    const score = matchCount - extraCount;
    if (score > bestScore) {
      bestScore = score;
      best = variant.name;
    }
  }

  return best;
}

/**
 * Format a schema key or type name as a human-readable label.
 * "tense_aspect" -> "Tense Aspect"
 * "SubjectNoun" -> "Noun"
 */
export function formatLabel(key: string): string {
  if (!key) return "";
  let label = key
    .replace(/^Subject(?=Noun|Verb)/, "")
    .replace(/^Object(?=Noun)/, "");
  label = label.replace(/([a-z])([A-Z])/g, "$1 $2");
  label = label.replace(/_/g, " ");
  return label.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/**
 * Format an enum value for display.
 * "past_simple" -> "Past Simple"
 */
export function formatEnumValue(val: string): string {
  if (!val) return "";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
