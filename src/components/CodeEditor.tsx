"use client";

import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

function getLanguageFromPath(path?: string): string {
  if (!path) return "python";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  return "plaintext";
}

export default function CodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
}: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={language ?? "python"}
      value={value}
      onChange={(val) => onChange?.(val ?? "")}
      theme="vs-light"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 4,
      }}
    />
  );
}

export { getLanguageFromPath };
