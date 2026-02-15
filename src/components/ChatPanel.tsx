"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSettings } from "@/lib/store";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/assistant/tools";
import { buildSystemPrompt } from "@/lib/assistant/system-prompt";
import type { ValidationResult } from "@/lib/pyodide/manager";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DisplayMessage {
  type: "user" | "assistant" | "tool-activity";
  content: string;
}

interface ChatPanelProps {
  owner: string;
  repo: string;
  tree: TreeNode[];
  selectedFile: string | null;
  validationResult: ValidationResult | null;
  onFileWrite?: (path: string, content: string) => void;
}

const MAX_TOOL_ITERATIONS = 10;

export default function ChatPanel({
  owner,
  repo,
  tree,
  selectedFile,
  validationResult,
  onFileWrite,
}: ChatPanelProps) {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [apiMessages, setApiMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { anthropicKey, preferredModel } = useSettings();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  async function callLLM(messages: any[], system: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (anthropicKey) {
      headers["x-llm-api-key"] = anthropicKey;
    }

    const res = await fetch("/api/llm/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: "anthropic",
        model: preferredModel || "claude-sonnet-4-5-20250929",
        system,
        messages,
        tools: TOOL_DEFINITIONS,
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `API error ${res.status}`);
    }

    return res.json();
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setLoading(true);

    const newDisplay: DisplayMessage[] = [
      ...displayMessages,
      { type: "user", content: userText },
    ];
    setDisplayMessages(newDisplay);

    const newApiMessages = [
      ...apiMessages,
      { role: "user", content: userText },
    ];

    const system = buildSystemPrompt({
      owner,
      repo,
      fileTree: tree,
      selectedFile,
      validationResult,
    });

    try {
      let messages = newApiMessages;
      let iterations = 0;

      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        const response = await callLLM(messages, system);

        messages = [
          ...messages,
          { role: "assistant", content: response.content },
        ];

        // Extract text for display
        const textBlocks = response.content
          ?.filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");

        if (textBlocks) {
          setDisplayMessages((prev) => [
            ...prev,
            { type: "assistant", content: textBlocks },
          ]);
        }

        if (response.stop_reason !== "tool_use") {
          break;
        }

        // Execute tool calls
        const toolUseBlocks = response.content?.filter(
          (b: any) => b.type === "tool_use"
        );

        const toolResults: any[] = [];
        for (const toolUse of toolUseBlocks) {
          const activityLabel =
            toolUse.name === "write_file"
              ? `Writing ${toolUse.input.path}...`
              : toolUse.name === "read_file"
                ? `Reading ${toolUse.input.path}...`
                : toolUse.name === "list_files"
                  ? `Listing files...`
                  : `Reading framework: ${toolUse.input.path}...`;

          setDisplayMessages((prev) => [
            ...prev,
            { type: "tool-activity", content: activityLabel },
          ]);

          const result = await executeTool(toolUse.name, toolUse.input, {
            owner,
            repo,
          });

          if (toolUse.name === "write_file" && !result.startsWith("Error")) {
            onFileWrite?.(toolUse.input.path, toolUse.input.content);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        messages = [...messages, { role: "user", content: toolResults }];
      }

      setApiMessages(messages);
    } catch (e) {
      setDisplayMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Request failed"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {displayMessages.length === 0 && (
          <p className="text-xs text-gray-400 p-2">
            Ask questions about your language package, or ask the assistant to
            read and modify files.
          </p>
        )}
        {displayMessages.map((msg, i) => {
          if (msg.type === "tool-activity") {
            return (
              <div
                key={i}
                className="text-xs text-gray-400 italic px-2 py-0.5"
              >
                {msg.content}
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`text-sm rounded-md p-2 ${
                msg.type === "user"
                  ? "bg-gray-100 text-gray-800"
                  : "bg-blue-50 text-gray-800"
              }`}
            >
              <span className="font-medium text-xs text-gray-500 block mb-1">
                {msg.type === "user" ? "You" : "Assistant"}
              </span>
              {msg.type === "assistant" ? (
                <div className="prose prose-sm prose-gray max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="text-xs text-gray-400 italic px-2 py-0.5">
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about your language package..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none resize-none overflow-y-auto"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
