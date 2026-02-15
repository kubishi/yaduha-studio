/**
 * Maps ValidationResult errors into Monaco editor markers (squiggly underlines).
 */

import type { editor, MarkerSeverity as MarkerSeverityType } from "monaco-editor";
import type { ValidationResult } from "@/lib/pyodide/manager";

/**
 * Parse a Python error/traceback string for file path and line number.
 * Returns the last match referring to `filePath`, or null.
 */
function parseErrorLocation(
  error: string,
  filePath: string,
): { line: number } | null {
  // Standard traceback:  File "/repo/yaduha_ovp/__init__.py", line 42
  const tracebackRe = /File "\/repo\/(.+?)", line (\d+)/g;
  // SyntaxError inline:  (yaduha_ovp/__init__.py, line 42)
  const syntaxRe = /\((.+?), line (\d+)\)/g;

  let bestMatch: { line: number } | null = null;

  for (const re of [tracebackRe, syntaxRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(error)) !== null) {
      if (m[1] === filePath) {
        bestMatch = { line: parseInt(m[2], 10) };
      }
    }
  }

  return bestMatch;
}

export function updateValidationMarkers(
  monaco: {
    editor: typeof import("monaco-editor").editor;
    MarkerSeverity: typeof MarkerSeverityType;
  },
  editorInstance: editor.IStandaloneCodeEditor,
  validationResult: ValidationResult | null,
  currentFilePath: string | null,
): void {
  const model = editorInstance.getModel();
  if (!model) return;

  // Clear markers when there's no result or validation passed
  if (!validationResult || validationResult.valid) {
    monaco.editor.setModelMarkers(model, "yaduha", []);
    return;
  }

  const errorMsg = validationResult.error ?? "Validation failed";
  const fullMsg = validationResult.error_type
    ? `${validationResult.error_type}: ${errorMsg}`
    : errorMsg;

  // Try to extract a line number for the current file
  const location =
    currentFilePath ? parseErrorLocation(errorMsg, currentFilePath) : null;

  if (location) {
    const lineNumber = Math.min(location.line, model.getLineCount());
    monaco.editor.setModelMarkers(model, "yaduha", [
      {
        severity: monaco.MarkerSeverity.Error,
        message: fullMsg,
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: model.getLineMaxColumn(lineNumber),
      },
    ]);
    return;
  }

  // Check if error references a *different* file — don't show a marker here
  const anyFileRe = /File "\/repo\//;
  if (currentFilePath && anyFileRe.test(errorMsg)) {
    monaco.editor.setModelMarkers(model, "yaduha", []);
    return;
  }

  // No file info at all — show at line 1 as fallback
  monaco.editor.setModelMarkers(model, "yaduha", [
    {
      severity: monaco.MarkerSeverity.Error,
      message: fullMsg,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: model.getLineMaxColumn(1),
    },
  ]);
}
