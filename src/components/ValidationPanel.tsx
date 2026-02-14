"use client";

import type { ValidationResult } from "@/lib/pyodide/manager";

interface ValidationPanelProps {
  result: ValidationResult | null;
  loading: boolean;
  pyodideReady: boolean;
  onValidate: () => void;
}

export default function ValidationPanel({
  result,
  loading,
  pyodideReady,
  onValidate,
}: ValidationPanelProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Validation</h3>
        <button
          onClick={onValidate}
          disabled={!pyodideReady || loading}
          className="rounded-md bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Validating..." : pyodideReady ? "Validate" : "Loading Pyodide..."}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-md p-3 text-sm ${
            result.valid
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {result.valid ? (
            <div>
              <p className="font-medium text-green-800">Valid language package</p>
              <p className="text-green-700 mt-1">
                Language: {result.name} ({result.language})
              </p>
              {result.sentence_types && (
                <p className="text-green-700">
                  Sentence types: {result.sentence_types.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-medium text-red-800">Validation failed</p>
              <p className="text-red-700 mt-1 font-mono text-xs">
                {result.error_type}: {result.error}
              </p>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <p className="text-xs text-gray-400">
          Click Validate to check this language package.
        </p>
      )}
    </div>
  );
}
