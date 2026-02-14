"use client";

import { useState } from "react";
import { useSettings } from "@/lib/store";
import type { ValidationResult, TranslateResult } from "@/lib/pyodide/manager";

interface TranslatePanelProps {
  validationResult: ValidationResult | null;
  onTranslate: (params: {
    english: string;
    provider: string;
    model: string;
    apiKey?: string;
  }) => Promise<TranslateResult>;
}

export default function TranslatePanel({
  validationResult,
  onTranslate,
}: TranslatePanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { anthropicKey, openaiKey, preferredProvider, preferredModel } =
    useSettings();

  const isValid = validationResult?.valid === true;

  async function handleTranslate() {
    if (!input.trim() || !isValid) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const apiKey =
      preferredProvider === "openai" ? openaiKey : anthropicKey;

    try {
      const res = await onTranslate({
        english: input,
        provider: preferredProvider,
        model: preferredModel || (preferredProvider === "openai" ? "gpt-4o" : "claude-sonnet-4-5-20250929"),
        apiKey: apiKey || undefined,
      });

      if (!res.ok) {
        setError(res.error || "Translation failed");
      } else {
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!isValid) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Translate</h3>
        <p className="text-xs text-gray-400">
          Run validation first to enable translation.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        Translate{validationResult?.name ? ` → ${validationResult.name}` : ""}
      </h3>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          English sentence
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTranslate()}
          placeholder="The dog is running."
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>

      <button
        onClick={handleTranslate}
        disabled={loading || !input.trim()}
        className="w-full rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Translating..." : "Translate"}
      </button>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {/* Target translation */}
          <div className="rounded-md bg-green-50 border border-green-200 p-2">
            <p className="text-xs font-medium text-green-800 mb-1">
              Translation
            </p>
            <p className="text-sm text-green-900">{result.target}</p>
          </div>

          {/* Back-translation */}
          {result.back_translation && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-2">
              <p className="text-xs font-medium text-blue-800 mb-1">
                Back-translation
              </p>
              <p className="text-sm text-blue-900">{result.back_translation}</p>
            </div>
          )}

          {/* Structured data */}
          {result.sentences && result.sentences.length > 0 && (
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-gray-600">
                Structured data ({result.sentence_types?.join(", ")})
              </summary>
              <pre className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-x-auto">
                {JSON.stringify(result.sentences, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
