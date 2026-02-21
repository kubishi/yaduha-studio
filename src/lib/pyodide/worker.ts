/**
 * Web Worker that loads Pyodide and runs yaduha validation + translation.
 *
 * Communication protocol:
 *   Main -> Worker: { type: "validate", files: Record<string, string> }
 *   Main -> Worker: { type: "translate", english: string, provider: string, model: string, apiKey?: string }
 *   Worker -> Main: { type: "ready" }
 *   Worker -> Main: { type: "result", data: ... }
 *   Worker -> Main: { type: "error", message: string }
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare function importScripts(...urls: string[]): void;
declare function loadPyodide(): Promise<any>;

let pyodide: any = null;

async function initPyodide() {
  importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js");

  pyodide = await loadPyodide();

  // Install yaduha core (pydantic + tomli only)
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  await micropip.install("yaduha");

  // Define the translation helper module in Pyodide
  // This replicates PipelineTranslator logic without importing yaduha.agent
  // (which requires openai). Uses sync XHR via JS interop for LLM calls.
  pyodide.runPython(`
import json
import re
from typing import List, Union, Tuple, Type
from pydantic import BaseModel, create_model
from js import XMLHttpRequest

def _llm_call(messages, system, provider, model, api_key, proxy_url):
    """Make a synchronous LLM call via the server proxy."""
    from js import console
    console.log(f"[pyodide] _llm_call: provider={provider}, model={model}, messages={len(messages)}")
    xhr = XMLHttpRequest.new()
    xhr.open("POST", proxy_url, False)
    xhr.setRequestHeader("Content-Type", "application/json")
    if api_key:
        xhr.setRequestHeader("x-llm-api-key", api_key)

    body = json.dumps({
        "provider": provider,
        "model": model,
        "system": system,
        "messages": messages,
        "stream": False,
    })
    xhr.send(body)

    console.log(f"[pyodide] _llm_call response status={xhr.status}")
    if xhr.status != 200:
        console.error(f"[pyodide] _llm_call error: {xhr.responseText[:500]}")
        raise RuntimeError(f"LLM proxy returned {xhr.status}: {xhr.responseText[:200]}")

    data = json.loads(xhr.responseText)
    if "error" in data:
        console.error(f"[pyodide] _llm_call API error: {data['error']}")
        raise RuntimeError(f"LLM error: {data['error']}")
    console.log(f"[pyodide] _llm_call success, response length={len(data['text'])}")
    return data["text"]


def _clean_text(s):
    s = s.strip()
    if not re.search(r'[.!?]$', s):
        s += '.'
    if s:
        s = s[0].upper() + s[1:]
    return s


def translate_with_pipeline(language, english, provider, model, api_key, proxy_url):
    """
    Replicate PipelineTranslator logic:
    1. English -> structured sentences (using schema injection like AnthropicAgent)
    2. str() on each sentence -> target language
    3. Back-translation: structured -> English (using few-shot examples)
    """
    sentence_types = language.sentence_types

    # --- Stage 1: English -> Structured Sentences ---

    # Build dynamic SentenceList model (like EnglishToSentencesTool)
    if len(sentence_types) == 1:
        sentence_union = sentence_types[0]
    else:
        sentence_union = Union[tuple(sentence_types)]

    TargetSentenceList = create_model(
        "TargetSentenceList",
        sentences=(List[sentence_union], ...),
        __base__=BaseModel,
    )

    schema_str = json.dumps(TargetSentenceList.model_json_schema())

    system_prompt = (
        "You are a translator that transforms natural English sentences into structured sentences. "
        "Given the output format, you may not be able to represent all the details of the input sentence, "
        "but you must capture as much meaning as possible. "
        "\\n\\nRespond with valid JSON matching this schema: " + schema_str +
        "\\nRespond ONLY with the JSON object, no markdown, no explanation."
    )

    messages = [{"role": "user", "content": english}]

    raw_response = _llm_call(messages, system_prompt, provider, model, api_key, proxy_url)

    # Strip markdown code blocks if present
    text = raw_response.strip()
    if text.startswith("\`\`\`"):
        lines = text.split("\\n")
        lines = lines[1:]  # remove opening
        if lines and lines[-1].strip() == "\`\`\`":
            lines = lines[:-1]
        text = "\\n".join(lines).strip()

    # Parse into Pydantic model
    sentence_list = TargetSentenceList(**json.loads(text))

    # --- Stage 2: Target language strings ---
    targets = []
    for sentence in sentence_list.sentences:
        targets.append(_clean_text(str(sentence)))

    # --- Stage 3: Back-translation (structured -> English) ---
    back_translations = []
    for sentence in sentence_list.sentences:
        # Build few-shot examples from this sentence type's get_examples()
        example_messages = []
        if hasattr(type(sentence), 'get_examples'):
            try:
                for ex_english, ex_instance in type(sentence).get_examples():
                    example_messages.append({
                        "role": "user",
                        "content": json.dumps(ex_instance.model_dump_json(), ensure_ascii=False)
                    })
                    example_messages.append({
                        "role": "assistant",
                        "content": ex_english
                    })
            except Exception:
                pass

        bt_system = (
            "You are a translator that transforms structured sentences into natural English. "
            "The sentences may be strange and unusual, but you must translate them as accurately as possible. "
        )
        bt_messages = [
            *example_messages,
            {"role": "user", "content": json.dumps(sentence.model_dump_json(), ensure_ascii=False)}
        ]

        bt_response = _llm_call(bt_messages, bt_system, provider, model, api_key, proxy_url)
        back_translations.append(_clean_text(bt_response))

    return {
        "target": " ".join(targets),
        "back_translation": " ".join(back_translations),
        "sentences": [s.model_dump(mode="json") for s in sentence_list.sentences],
        "sentence_types": [type(s).__name__ for s in sentence_list.sentences],
    }
`);

  self.postMessage({ type: "ready" });
}

self.onmessage = async (event) => {
  const { type } = event.data;

  if (type === "validate") {
    const { files } = event.data;
    try {
      if (!pyodide) throw new Error("Pyodide not initialized");

      const FS = pyodide.FS;
      const repoDir = "/repo";

      try {
        pyodide.runPython(`
import shutil, os
if os.path.exists("${repoDir}"):
    shutil.rmtree("${repoDir}")
`);
      } catch {
        // Directory may not exist yet
      }

      FS.mkdirTree(repoDir);

      for (const [path, content] of Object.entries(files as Record<string, string>)) {
        const fullPath = `${repoDir}/${path}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        FS.mkdirTree(dir);
        FS.writeFile(fullPath, content);
      }

      const result = pyodide.runPython(`
import json
import sys
sys.path.insert(0, "${repoDir}")

from yaduha.loader import LanguageLoader

try:
    language = LanguageLoader.load_language_from_source("${repoDir}")

    # Build schema + examples for each sentence type
    schemas = {}
    for st in language.sentence_types:
        schema_info = {
            "name": st.__name__,
            "json_schema": st.model_json_schema(),
            "examples": [],
        }
        if hasattr(st, "get_examples"):
            try:
                for english, instance in st.get_examples():
                    schema_info["examples"].append({
                        "english": english,
                        "structured": instance.model_dump(mode="json"),
                        "target": str(instance),
                    })
            except Exception:
                pass
        schemas[st.__name__] = schema_info

    result = {
        "valid": True,
        "language": language.code,
        "name": language.name,
        "sentence_types": [st.__name__ for st in language.sentence_types],
        "schemas": schemas,
    }
except Exception as e:
    result = {
        "valid": False,
        "error": str(e),
        "error_type": type(e).__name__,
    }

json.dumps(result)
`);

      self.postMessage({ type: "result", data: JSON.parse(result) });
    } catch (e) {
      self.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (type === "render") {
    const { sentenceType, data } = event.data;
    try {
      if (!pyodide) throw new Error("Pyodide not initialized");

      pyodide.globals.set("_render_sentence_type", sentenceType);
      pyodide.globals.set("_render_data", JSON.stringify(data));

      const result = pyodide.runPython(`
import json

try:
    _render_st_class = None
    for _st in language.sentence_types:
        if _st.__name__ == _render_sentence_type:
            _render_st_class = _st
            break

    if _render_st_class is None:
        _render_output = {"error": f"Unknown sentence type: {_render_sentence_type}"}
    else:
        _render_instance = _render_st_class(**json.loads(_render_data))
        _render_output = {"rendered": str(_render_instance)}
except Exception as e:
    _render_output = {"error": str(e)}

json.dumps(_render_output)
`);

      self.postMessage({ type: "result", data: JSON.parse(result) });
    } catch (e) {
      self.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (type === "translate") {
    const { english, provider, model, apiKey, origin } = event.data;
    console.log("[worker] translate request:", { english, provider, model, hasApiKey: !!apiKey, origin });
    try {
      if (!pyodide) throw new Error("Pyodide not initialized");

      // Set translate params as Python globals
      pyodide.globals.set("_translate_english", english);
      pyodide.globals.set("_translate_provider", provider);
      pyodide.globals.set("_translate_model", model);
      pyodide.globals.set("_translate_api_key", apiKey || "");
      pyodide.globals.set("_translate_proxy_url", `${origin}/api/llm/chat`);

      const result = pyodide.runPython(`
import json

# language was loaded during validation
try:
    _tr_result = translate_with_pipeline(
        language,
        _translate_english,
        _translate_provider,
        _translate_model,
        _translate_api_key if _translate_api_key else None,
        _translate_proxy_url,
    )
    _tr_output = {"ok": True, **_tr_result}
except Exception as e:
    _tr_output = {"ok": False, "error": str(e), "error_type": type(e).__name__}

json.dumps(_tr_output)
`);

      console.log("[worker] translate result:", result);
      self.postMessage({ type: "result", data: JSON.parse(result) });
    } catch (e) {
      console.error("[worker] translate error:", e);
      self.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
};

// Start loading Pyodide immediately
initPyodide().catch((e) => {
  self.postMessage({ type: "error", message: `Failed to init Pyodide: ${e}` });
});
