/**
 * Monaco completion provider for Yaduha framework snippets.
 * Offers boilerplate templates for common Yaduha patterns.
 */

import type { languages, editor, Position, IRange } from "monaco-editor";

export function createYaduhaCompletionProvider(
  monaco: { languages: typeof import("monaco-editor").languages },
): languages.CompletionItemProvider {
  return {
    provideCompletionItems(
      model: editor.ITextModel,
      position: Position,
    ): languages.ProviderResult<languages.CompletionList> {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = [
        {
          label: "yaduha-sentence",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: New Sentence Type",
          documentation: {
            value:
              "Insert a full Sentence subclass with `__str__` and `get_examples`.",
          },
          insertText: [
            "class ${1:MySentence}(Sentence):",
            '    ${2:subject}: str = Field(description="${3:The subject}")',
            "",
            "    def __str__(self) -> str:",
            '        return f"{self.$2}"',
            "",
            "    @classmethod",
            "    def get_examples(cls):",
            "        return [",
            '            ("${4:Example English.}", cls($2="${5:target_word}")),',
            "        ]",
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: "yaduha-language",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: Language Definition",
          documentation: {
            value: "Insert a `language = Language(...)` definition.",
          },
          insertText: [
            "language = Language(",
            '    code="${1:lang_code}",',
            '    name="${2:Language Name}",',
            "    sentence_types=(${3:SentenceType},),",
            ")",
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: "yaduha-get-examples",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: get_examples Method",
          documentation: {
            value:
              "Insert a `get_examples` classmethod returning example tuples.",
          },
          insertText: [
            "@classmethod",
            "def get_examples(cls):",
            "    return [",
            '        ("${1:English sentence.}", cls(${2:field}="${3:value}")),',
            "    ]",
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: "yaduha-str",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: __str__ Method",
          documentation: {
            value:
              "Insert a `__str__` method that renders the sentence in the target language.",
          },
          insertText: [
            "def __str__(self) -> str:",
            '    return f"${1:{self.field}}"',
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: "yaduha-vocab",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: VocabEntry List",
          documentation: {
            value:
              "Insert a list of VocabEntry instances for vocabulary lookup.",
          },
          insertText: [
            "${1:VOCAB} = [",
            '    VocabEntry(english="${2:word}", target="${3:translation}"),',
            "]",
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: "yaduha-field",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: Field with Description",
          documentation: {
            value:
              "Insert a typed field with a Pydantic `Field(description=...)`.",
          },
          insertText:
            '${1:field_name}: ${2:str} = Field(description="${3:Description}")',
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: "yaduha-enum",
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: "Yaduha: Grammatical Enum",
          documentation: {
            value:
              "Insert a `str, Enum` class for grammatical categories (person, tense, etc.).",
          },
          insertText: [
            "class ${1:Category}(str, Enum):",
            '    ${2:value1} = "${2:value1}"',
            '    ${3:value2} = "${3:value2}"',
          ].join("\n"),
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
      ];

      return { suggestions };
    },
  };
}
