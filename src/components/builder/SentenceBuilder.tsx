"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SchemaField from "./SchemaField";
import type { ValidationResult } from "@/lib/pyodide/manager";
import {
  buildDefaultValue,
  type JsonSchema,
} from "@/lib/schema-utils";

interface SentenceBuilderProps {
  validationResult: ValidationResult | null;
  validating: boolean;
  onRender: (
    sentenceType: string,
    data: Record<string, unknown>
  ) => Promise<string | null>;
}

export default function SentenceBuilder({
  validationResult,
  validating,
  onRender,
}: SentenceBuilderProps) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [rendered, setRendered] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const renderCounter = useRef(0);

  const schemas = validationResult?.schemas;
  const typeNames = useMemo(
    () => (schemas ? Object.keys(schemas) : []),
    [schemas]
  );

  // Switch to a sentence type: reset form data from schema defaults
  const switchType = useCallback(
    (typeName: string) => {
      if (!schemas?.[typeName]) return;
      const jsonSchema = schemas[typeName].json_schema as JsonSchema;
      setActiveType(typeName);
      setFormData(
        (buildDefaultValue(jsonSchema, jsonSchema) as Record<string, unknown>) ?? {}
      );
      setRendered(null);
    },
    [schemas]
  );

  // When validation result changes, reset or update the active type
  const prevSchemaKeysRef = useRef<string>("");
  useEffect(() => {
    if (!schemas || typeNames.length === 0) {
      setActiveType(null);
      return;
    }

    const schemaKeysStr = typeNames.join(",");

    // If the set of types changed, pick first (or keep current if still valid)
    if (schemaKeysStr !== prevSchemaKeysRef.current) {
      prevSchemaKeysRef.current = schemaKeysStr;
      if (!activeType || !typeNames.includes(activeType)) {
        switchType(typeNames[0]);
      } else {
        // Active type still exists — check if its schema structure changed
        const currentSchema = schemas[activeType].json_schema as JsonSchema;
        const propKeys = Object.keys(currentSchema.properties || {}).sort().join(",");
        const formKeys = Object.keys(formData).sort().join(",");
        if (propKeys !== formKeys) {
          switchType(activeType);
        }
      }
    }
  }, [schemas, typeNames, activeType, switchType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced render
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeType || !validationResult?.valid) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const counter = ++renderCounter.current;
      setRendering(true);
      try {
        const result = await onRender(activeType, formData);
        // Only update if this is still the latest render call
        if (counter === renderCounter.current) {
          setRendered(result);
        }
      } catch {
        if (counter === renderCounter.current) {
          setRendered(null);
        }
      } finally {
        if (counter === renderCounter.current) {
          setRendering(false);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeType, formData, validationResult?.valid, onRender]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadExample() {
    if (!activeType || !schemas?.[activeType]) return;
    const examples = schemas[activeType].examples;
    if (examples.length === 0) return;
    const ex = examples[Math.floor(Math.random() * examples.length)];
    setFormData(ex.structured as Record<string, unknown>);
  }

  // Get active schema for rendering
  const activeSchema = activeType
    ? (schemas?.[activeType]?.json_schema as JsonSchema | undefined)
    : null;
  const topLevelProperties = activeSchema?.properties
    ? Object.entries(activeSchema.properties)
    : [];
  const hasExamples =
    activeType && schemas?.[activeType]?.examples?.length
      ? schemas[activeType].examples.length > 0
      : false;

  // --- Guard states ---

  if (validating) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-400">Validating...</p>
        </div>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">
          Waiting for validation...
        </p>
      </div>
    );
  }

  if (!validationResult.valid) {
    return (
      <div className="p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">Validation Failed</p>
          <p className="text-xs text-red-600 mt-1 font-mono whitespace-pre-wrap">
            {validationResult.error}
          </p>
        </div>
      </div>
    );
  }

  if (typeNames.length === 0 || !activeType || !activeSchema) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">No sentence types found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: type tabs + actions */}
      <div className="border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {typeNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => switchType(name)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeType === name
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {name.replace(/Sentence$/, "")}
              </button>
            ))}
          </div>
          {hasExamples && (
            <button
              type="button"
              onClick={loadExample}
              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Load Example
            </button>
          )}
        </div>
      </div>

      {/* Rendered sentence display */}
      <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
        {rendered ? (
          <p className="text-base font-medium text-gray-900">{rendered}</p>
        ) : rendering ? (
          <p className="text-sm text-gray-400 italic">Rendering...</p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Fill in the fields below to build a sentence
          </p>
        )}
      </div>

      {/* Form grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${topLevelProperties.length}, 1fr)`,
          }}
        >
          {topLevelProperties.map(([propKey, propSchema]) => (
            <div
              key={propKey}
              className="rounded-lg border border-gray-200 p-3"
            >
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {propKey.replace(/_/g, " ")}
              </h3>
              <SchemaField
                value={
                  (formData as Record<string, unknown>)[propKey] ?? null
                }
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, [propKey]: val }))
                }
                schema={propSchema as JsonSchema}
                rootSchema={activeSchema}
                fieldKey={propKey}
                required={activeSchema.required?.includes(propKey) ?? false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Compact validation status */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
        <p className="text-xs text-gray-400">
          <span className="text-green-600">&#10003;</span>{" "}
          {validationResult.name} ({validationResult.language}) &mdash;{" "}
          {typeNames.length} sentence type{typeNames.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
