"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveSchema,
  classifySchema,
  getUnionVariants,
  buildDefaultValue,
  detectVariant,
  formatLabel,
  formatEnumValue,
  type JsonSchema,
} from "@/lib/schema-utils";
import InfoButton from "./InfoButton";

interface SchemaFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  schema: JsonSchema;
  rootSchema: JsonSchema;
  fieldKey: string;
  required?: boolean;
  depth?: number;
}

export default function SchemaField({
  value,
  onChange,
  schema,
  rootSchema,
  fieldKey,
  depth = 0,
}: SchemaFieldProps) {
  const resolved = useMemo(
    () => resolveSchema(schema, rootSchema) || {},
    [schema, rootSchema]
  );
  const classification = useMemo(
    () => classifySchema(schema, rootSchema),
    [schema, rootSchema]
  );
  const label = useMemo(() => formatLabel(fieldKey), [fieldKey]);

  const variants = useMemo(() => {
    if (classification !== "union" || !resolved.anyOf) return [];
    return getUnionVariants(resolved.anyOf, rootSchema);
  }, [classification, resolved.anyOf, rootSchema]);

  const nonNullSchema = useMemo(() => {
    if (!resolved.anyOf) return null;
    const nonNull = resolved.anyOf.filter((item) => item.type !== "null");
    if (nonNull.length === 1) return resolveSchema(nonNull[0], rootSchema);
    return null;
  }, [resolved.anyOf, rootSchema]);

  const [selectedVariant, setSelectedVariant] = useState("");
  const userSwitchedRef = useRef(false);

  // Detect variant from value
  useEffect(() => {
    if (classification !== "union" || variants.length === 0) return;
    if (userSwitchedRef.current) {
      userSwitchedRef.current = false;
      return;
    }
    setSelectedVariant(detectVariant(value, variants));
  }, [classification, variants, JSON.stringify(value)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize variant if not set
  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0].name);
    }
  }, [variants, selectedVariant]);

  const activeVariantSchema = useMemo(
    () => variants.find((v) => v.name === selectedVariant)?.schema || null,
    [variants, selectedVariant]
  );

  function updateProperty(key: string, val: unknown) {
    onChange({ ...(value as Record<string, unknown>), [key]: val });
  }

  function switchVariant(variantName: string) {
    setSelectedVariant(variantName);
    const variant = variants.find((v) => v.name === variantName);
    if (variant) {
      userSwitchedRef.current = true;
      onChange(buildDefaultValue(variant.schema, rootSchema));
    }
  }

  function toggleOptional(checked: boolean) {
    if (checked && nonNullSchema) {
      onChange(buildDefaultValue(nonNullSchema, rootSchema));
    } else {
      onChange(null);
    }
  }

  // --- Enum ---
  if (classification === "enum") {
    return (
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {label}
          {resolved.description && <InfoButton text={resolved.description} />}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="">Select...</option>
          {resolved.enum?.map((val) => (
            <option key={val} value={val}>
              {formatEnumValue(val)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // --- Boolean ---
  if (classification === "boolean") {
    return (
      <div className="mb-3">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          {label}
          {resolved.description && <InfoButton text={resolved.description} />}
        </label>
      </div>
    );
  }

  // --- Union ---
  if (classification === "union") {
    return (
      <div className="mb-3">
        <div className="flex gap-1 mb-2">
          {variants.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => switchVariant(v.name)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                selectedVariant === v.name
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {formatLabel(v.name)}
            </button>
          ))}
        </div>
        {activeVariantSchema && (
          <div className="pl-2 border-l-2 border-blue-200">
            {activeVariantSchema.properties ? (
              Object.entries(activeVariantSchema.properties).map(
                ([propKey, propSchema]) => (
                  <SchemaField
                    key={`${selectedVariant}-${propKey}`}
                    value={
                      (value as Record<string, unknown> | null)?.[propKey] ??
                      null
                    }
                    onChange={(val) => updateProperty(propKey, val)}
                    schema={resolveSchema(
                      propSchema as JsonSchema,
                      rootSchema
                    )}
                    rootSchema={rootSchema}
                    fieldKey={propKey}
                    required={
                      activeVariantSchema.required?.includes(propKey) ?? false
                    }
                    depth={depth + 1}
                  />
                )
              )
            ) : (
              <SchemaField
                value={value}
                onChange={onChange}
                schema={activeVariantSchema}
                rootSchema={rootSchema}
                fieldKey={selectedVariant}
                required
                depth={depth + 1}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Optional ---
  if (classification === "optional") {
    return (
      <div className="mb-3">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer mb-1">
          <input
            type="checkbox"
            checked={value != null}
            onChange={(e) => toggleOptional(e.target.checked)}
            className="rounded border-gray-300"
          />
          {label}
          {resolved.description && <InfoButton text={resolved.description} />}
        </label>
        {value != null && nonNullSchema && (
          <div className="pl-3 border-l-2 border-gray-200">
            <SchemaField
              value={value}
              onChange={onChange}
              schema={nonNullSchema}
              rootSchema={rootSchema}
              fieldKey={fieldKey}
              depth={depth + 1}
            />
          </div>
        )}
      </div>
    );
  }

  // --- Object ---
  if (classification === "object" && resolved.properties) {
    return (
      <div className="mb-3">
        {resolved.properties &&
          Object.entries(resolved.properties).map(([propKey, propSchema]) => (
            <SchemaField
              key={propKey}
              value={
                (value as Record<string, unknown> | null)?.[propKey] ?? null
              }
              onChange={(val) => updateProperty(propKey, val)}
              schema={resolveSchema(propSchema as JsonSchema, rootSchema)}
              rootSchema={rootSchema}
              fieldKey={propKey}
              required={resolved.required?.includes(propKey) ?? false}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  // --- String ---
  if (classification === "string") {
    return (
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {label}
          {resolved.description && <InfoButton text={resolved.description} />}
        </label>
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
    );
  }

  // --- Unknown ---
  return null;
}
