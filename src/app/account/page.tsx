"use client";

import { useState } from "react";
import { useSettings } from "@/lib/store";

function MaskedInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const {
    anthropicKey,
    openaiKey,
    preferredProvider,
    preferredModel,
    setAnthropicKey,
    setOpenaiKey,
    setPreferredProvider,
    setPreferredModel,
    clearKeys,
  } = useSettings();

  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          API keys are stored locally in your browser and never sent to our
          servers. They are passed directly to the LLM provider via the proxy.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>

        <MaskedInput
          label="Anthropic API Key"
          value={anthropicKey}
          onChange={setAnthropicKey}
          placeholder="sk-ant-..."
        />

        <MaskedInput
          label="OpenAI API Key"
          value={openaiKey}
          onChange={setOpenaiKey}
          placeholder="sk-..."
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Model Preferences
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider
          </label>
          <select
            value={preferredProvider}
            onChange={(e) =>
              setPreferredProvider(e.target.value as "anthropic" | "openai")
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Model (optional override)
          </label>
          <input
            type="text"
            value={preferredModel}
            onChange={(e) => setPreferredModel(e.target.value)}
            placeholder={
              preferredProvider === "anthropic"
                ? "claude-sonnet-4-5-20250929"
                : "gpt-4o"
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Leave blank to use the default model for the selected provider.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          {saved ? "Saved!" : "Save"}
        </button>
        <button
          onClick={clearKeys}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Clear All Keys
        </button>
      </div>
    </div>
  );
}
