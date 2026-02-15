"use client";

import { useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  registerYaduhaProviders,
  updateValidationMarkers,
  applyYaduhaDecorations,
} from "@/lib/monaco";
import type { ValidationResult } from "@/lib/pyodide/manager";

interface CodeEditorProps {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  validationResult?: ValidationResult | null;
  filePath?: string | null;
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
  validationResult,
  filePath,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef =
    useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);

  const refreshDecorations = useCallback(() => {
    if (!editorRef.current) return;
    // Clear previous decorations
    decorationsRef.current?.clear();
    decorationsRef.current = applyYaduhaDecorations(editorRef.current);
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerYaduhaProviders(monaco);
    refreshDecorations();

    // Re-apply decorations when content changes
    editor.onDidChangeModelContent(() => {
      refreshDecorations();
    });
  };

  // Update validation markers when result or file changes
  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      updateValidationMarkers(
        monacoRef.current,
        editorRef.current,
        validationResult ?? null,
        filePath ?? null,
      );
    }
  }, [validationResult, filePath]);

  // Re-apply decorations when switching files
  useEffect(() => {
    refreshDecorations();
  }, [filePath, refreshDecorations]);

  return (
    <Editor
      height="100%"
      language={language ?? "python"}
      value={value}
      onChange={(val) => onChange?.(val ?? "")}
      onMount={handleEditorDidMount}
      theme="vs-light"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 4,
        fixedOverflowWidgets: true,
      }}
    />
  );
}

export { getLanguageFromPath };
