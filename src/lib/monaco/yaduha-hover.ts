/**
 * Monaco hover provider for Yaduha framework symbols.
 * Shows documentation when hovering over framework classes, methods, and patterns.
 */

import type { languages, editor, Position, IRange } from "monaco-editor";

const YADUHA_DOCS: Record<string, { signature: string; doc: string }> = {
  Sentence: {
    signature: "class Sentence(BaseModel)",
    doc: "Base class for all sentence types in a Yaduha language package. Extends Pydantic BaseModel.\n\nSubclasses **must** implement:\n- `__str__(self) -> str` — render the sentence in the target language\n- `get_examples(cls) -> List[Tuple[str, Self]]` — return (English, instance) pairs",
  },
  Language: {
    signature:
      "Language(code: str, name: str, sentence_types: Tuple[Type[Sentence], ...])",
    doc: "Container class wrapping sentence types with language metadata.\n\n- `code` — ISO 639-3 language code\n- `name` — human-readable language name\n- `sentence_types` — tuple of Sentence subclasses (must be non-empty)",
  },
  VocabEntry: {
    signature: "VocabEntry(english: str, target: str)",
    doc: "Immutable data class linking an English lemma to a target-language equivalent.\n\nTypically used in lists to build lookup dictionaries.",
  },
  Field: {
    signature: "Field(..., description: str)",
    doc: "Pydantic Field descriptor. Use `description=` to document fields — the AI translator reads these descriptions to understand how to fill in structured fields.",
  },
  get_examples: {
    signature:
      "@classmethod\ndef get_examples(cls) -> List[Tuple[str, Self]]",
    doc: "Required classmethod on every Sentence subclass.\n\nReturns a list of `(english_sentence, structured_instance)` tuples that serve as few-shot examples for the AI translator.",
  },
  __str__: {
    signature: "def __str__(self) -> str",
    doc: "Required method on every Sentence subclass.\n\nRenders the structured sentence into the target language. Must return a non-empty string.",
  },
  field_validator: {
    signature: '@field_validator("field_name")\n@classmethod',
    doc: "Pydantic decorator for custom field validation. Stack with `@classmethod`. Useful for validating that field values exist in a vocabulary lookup.",
  },
  json_schema_extra: {
    signature: 'json_schema_extra={"enum": [...]}',
    doc: "Pydantic Field parameter. Use the `enum` key to constrain allowed values — the AI translator will only pick from this list.",
  },
  BaseModel: {
    signature: "class BaseModel",
    doc: "Pydantic base class. Use for helper models (Pronoun, Noun, Verb) that are **not** full sentence types but are used as fields within Sentence subclasses.",
  },
  LanguageLoader: {
    signature: "class LanguageLoader",
    doc: "Static utility class for discovering and validating installed language packages.\n\nKey methods:\n- `load_language(code)` — load by language code\n- `list_installed_languages()` — discover all installed\n- `validate_language(code)` — check package validity\n- `load_language_from_source(dir)` — load from source directory",
  },
};

export function createYaduhaHoverProvider(): languages.HoverProvider {
  return {
    provideHover(
      model: editor.ITextModel,
      position: Position,
    ): languages.ProviderResult<languages.Hover> {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const entry = YADUHA_DOCS[wordInfo.word];
      if (!entry) return null;

      const range: IRange = {
        startLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: wordInfo.endColumn,
      };

      return {
        range,
        contents: [
          { value: `\`\`\`python\n${entry.signature}\n\`\`\`` },
          { value: entry.doc },
        ],
      };
    },
  };
}
