"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSettings, useChatSessions } from "@/lib/store";
import type { DisplayMessage } from "@/lib/store";
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

interface ChatPanelProps {
  owner: string;
  repo: string;
  tree: TreeNode[];
  selectedFile: string | null;
  validationResult: ValidationResult | null;
  onFileWrite?: (path: string, content: string) => void;
  onRender?: (sentenceType: string, data: Record<string, unknown>) => Promise<string | null>;
  activeTab?: "editor" | "builder" | "translate";
}

const MAX_TOOL_ITERATIONS = 10;

export default function ChatPanel({
  owner,
  repo,
  tree,
  selectedFile,
  validationResult,
  onFileWrite,
  onRender,
  activeTab = "builder",
}: ChatPanelProps) {
  const repoKey = `${owner}/${repo}`;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { anthropicKey, preferredModel } = useSettings();
  const {
    getSessions,
    getActiveSession,
    createSession,
    setActiveSession,
    renameSession,
    deleteSession,
    updateSessionMessages,
  } = useChatSessions();

  const sessions = getSessions(repoKey);
  const activeSession = getActiveSession(repoKey);

  // Auto-create a session if none exist for this repo
  useEffect(() => {
    if (sessions.length === 0) {
      createSession(repoKey);
    }
  }, [repoKey, sessions.length, createSession]);

  // If no active session but sessions exist, select the latest
  useEffect(() => {
    if (!activeSession && sessions.length > 0) {
      setActiveSession(repoKey, sessions[sessions.length - 1].id);
    }
  }, [activeSession, sessions, repoKey, setActiveSession]);

  const displayMessages = activeSession?.displayMessages ?? [];
  const apiMessages = activeSession?.apiMessages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // Close session menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSessionMenu(false);
        setEditingSessionId(null);
      }
    }
    if (showSessionMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showSessionMenu]);

  const persistMessages = useCallback(
    (newDisplay: DisplayMessage[], newApi: any[]) => {
      if (activeSession) {
        updateSessionMessages(activeSession.id, newDisplay, newApi);
      }
    },
    [activeSession, updateSessionMessages]
  );

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
    if (!input.trim() || loading || !activeSession) return;

    const userText = input.trim();
    setInput("");
    setLoading(true);

    const newDisplay: DisplayMessage[] = [
      ...displayMessages,
      { type: "user", content: userText },
    ];
    persistMessages(newDisplay, apiMessages);

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
      activeTab,
    });

    try {
      let messages = newApiMessages;
      let currentDisplay = newDisplay;
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
          currentDisplay = [
            ...currentDisplay,
            { type: "assistant", content: textBlocks },
          ];
          persistMessages(currentDisplay, messages);
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
                  : toolUse.name === "run_examples"
                    ? `Running examples...`
                    : `Reading framework: ${toolUse.input.path}...`;

          currentDisplay = [
            ...currentDisplay,
            { type: "tool-activity", content: activityLabel },
          ];
          persistMessages(currentDisplay, messages);

          const result = await executeTool(toolUse.name, toolUse.input, {
            owner,
            repo,
            validationResult,
            onRender,
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

      persistMessages(currentDisplay, messages);
    } catch (e) {
      const errorDisplay: DisplayMessage[] = [
        ...displayMessages,
        { type: "user", content: userText },
        {
          type: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Request failed"}`,
        },
      ];
      persistMessages(errorDisplay, apiMessages);
    } finally {
      setLoading(false);
    }
  }

  function handleNewSession() {
    createSession(repoKey);
    setShowSessionMenu(false);
  }

  function handleSwitchSession(sessionId: string) {
    setActiveSession(repoKey, sessionId);
    setShowSessionMenu(false);
  }

  function handleStartRename(sessionId: string, currentName: string) {
    setEditingSessionId(sessionId);
    setEditingName(currentName);
  }

  function handleFinishRename() {
    if (editingSessionId && editingName.trim()) {
      renameSession(editingSessionId, editingName.trim());
    }
    setEditingSessionId(null);
  }

  function handleDeleteSession(sessionId: string) {
    if (sessions.length <= 1) return; // keep at least one
    deleteSession(repoKey, sessionId);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Session bar */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-1.5 shrink-0">
        <div className="relative flex-1 min-w-0" ref={menuRef}>
          <button
            onClick={() => setShowSessionMenu(!showSessionMenu)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors min-w-0 max-w-full"
          >
            <span className="truncate">{activeSession?.name ?? "Chat"}</span>
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSessionMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="p-1 max-h-60 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-1 rounded px-2 py-1.5 text-xs ${
                      session.id === activeSession?.id
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFinishRename();
                          if (e.key === "Escape") setEditingSessionId(null);
                        }}
                        className="flex-1 min-w-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:border-gray-500 focus:outline-none"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => handleSwitchSession(session.id)}
                          className="flex-1 min-w-0 text-left truncate"
                        >
                          {session.name}
                          <span className="ml-1 text-gray-400">
                            ({session.displayMessages.filter((m) => m.type === "user").length})
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(session.id, session.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-opacity"
                          title="Rename"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {sessions.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity"
                            title="Delete"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 p-1">
                <button
                  onClick={handleNewSession}
                  className="flex items-center gap-1.5 w-full rounded px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New chat
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleNewSession}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          title="New chat"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Messages */}
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

      {/* Input */}
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
