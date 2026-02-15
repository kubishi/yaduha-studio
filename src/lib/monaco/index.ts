import type { Monaco } from "@monaco-editor/react";
import { createYaduhaHoverProvider } from "./yaduha-hover";
import { createYaduhaCompletionProvider } from "./yaduha-completions";

let providersRegistered = false;

export function registerYaduhaProviders(monaco: Monaco): void {
  if (providersRegistered) return;
  providersRegistered = true;

  monaco.languages.registerHoverProvider(
    "python",
    createYaduhaHoverProvider(),
  );
  monaco.languages.registerCompletionItemProvider(
    "python",
    createYaduhaCompletionProvider(monaco),
  );
}

export { updateValidationMarkers } from "./yaduha-diagnostics";
export { applyYaduhaDecorations } from "./yaduha-highlight";
