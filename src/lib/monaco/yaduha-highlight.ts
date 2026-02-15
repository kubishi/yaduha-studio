/**
 * Visual highlighting for Yaduha framework keywords in the Monaco editor.
 * Uses inline decorations to make framework symbols visually distinct.
 */

import type { editor, IRange } from "monaco-editor";

/** Framework classes that get highlighted as "types" */
const FRAMEWORK_CLASSES = [
  "Sentence",
  "Language",
  "VocabEntry",
  "LanguageLoader",
];

/** Pydantic imports that get highlighted as "support" */
const PYDANTIC_KEYWORDS = [
  "BaseModel",
  "Field",
  "field_validator",
];

/** Required Yaduha methods */
const FRAMEWORK_METHODS = [
  "get_examples",
];

/** CSS class name for each highlight category */
const HIGHLIGHT_CLASSES = {
  frameworkClass: "yaduha-framework-class",
  pydanticKeyword: "yaduha-pydantic-keyword",
  frameworkMethod: "yaduha-framework-method",
} as const;

/** Inject CSS for decoration classes (idempotent) */
let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .${HIGHLIGHT_CLASSES.frameworkClass} {
      color: #0550ae !important;
      font-weight: 600 !important;
    }
    .${HIGHLIGHT_CLASSES.pydanticKeyword} {
      color: #6639ba !important;
      font-weight: 600 !important;
    }
    .${HIGHLIGHT_CLASSES.frameworkMethod} {
      color: #0550ae !important;
      font-style: italic !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Find all occurrences of a word in the model and return their ranges.
 * Only matches whole words (not substrings).
 */
function findWordRanges(
  model: editor.ITextModel,
  word: string,
): IRange[] {
  const ranges: IRange[] = [];
  // Use model.findMatches for efficient whole-word searching
  const matches = model.findMatches(
    word,
    true,   // searchOnlyEditableRange = false (search entire model)
    false,  // isRegex
    true,   // matchCase
    // Word boundary characters — matches whole words only
    "()[]{}.,;:=+-*/<>!@#$%^&|~`'\" \t\n",
    false,  // captureMatches
  );

  for (const match of matches) {
    ranges.push(match.range);
  }
  return ranges;
}

/**
 * Apply Yaduha framework highlighting decorations to the editor.
 * Call this on mount and on content change.
 */
export function applyYaduhaDecorations(
  editorInstance: editor.IStandaloneCodeEditor,
): editor.IEditorDecorationsCollection | null {
  const model = editorInstance.getModel();
  if (!model) return null;

  // Only apply to Python files
  if (model.getLanguageId() !== "python") return null;

  injectCSS();

  const decorations: editor.IModelDeltaDecoration[] = [];

  for (const word of FRAMEWORK_CLASSES) {
    for (const range of findWordRanges(model, word)) {
      decorations.push({
        range,
        options: {
          inlineClassName: HIGHLIGHT_CLASSES.frameworkClass,
        },
      });
    }
  }

  for (const word of PYDANTIC_KEYWORDS) {
    for (const range of findWordRanges(model, word)) {
      decorations.push({
        range,
        options: {
          inlineClassName: HIGHLIGHT_CLASSES.pydanticKeyword,
        },
      });
    }
  }

  for (const word of FRAMEWORK_METHODS) {
    for (const range of findWordRanges(model, word)) {
      decorations.push({
        range,
        options: {
          inlineClassName: HIGHLIGHT_CLASSES.frameworkMethod,
        },
      });
    }
  }

  return editorInstance.createDecorationsCollection(decorations);
}
