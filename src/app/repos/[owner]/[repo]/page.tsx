"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import CodeEditor, { getLanguageFromPath } from "@/components/CodeEditor";
import FileTree from "@/components/FileTree";
import TranslatePanel from "@/components/TranslatePanel";
import ChatPanel from "@/components/ChatPanel";
import SentenceBuilder from "@/components/builder/SentenceBuilder";
import { usePyodide } from "@/hooks/usePyodide";
import type { ValidationResult } from "@/lib/pyodide/manager";

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

/** Decode Base64 string as UTF-8 (atob only handles Latin-1). */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export default function RepoDetailPage() {
  const params = useParams<{ owner: string; repo: string }>();
  const { owner, repo } = params;

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingTree, setLoadingTree] = useState(true);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Right panel tab: editor (files + code), builder (sentence form), translate
  const [rightTab, setRightTab] = useState<"editor" | "builder" | "translate">("builder");

  // Persist tab preference
  useEffect(() => {
    const saved = localStorage.getItem("yaduha-studio-tab");
    if (saved === "editor" || saved === "builder" || saved === "translate") setRightTab(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("yaduha-studio-tab", rightTab);
  }, [rightTab]);

  // Dirty = edited since last save/validate
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  // Unpushed = saved locally but not yet pushed to GitHub
  const [unpushedFiles, setUnpushedFiles] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);

  // All files content for validation
  const [repoFiles, setRepoFiles] = useState<Record<string, string>>({});
  // Ref for latest repoFiles (avoids stale closure in runValidation)
  const repoFilesRef = useRef(repoFiles);
  useEffect(() => {
    repoFilesRef.current = repoFiles;
  }, [repoFiles]);

  // Validation tooltip hover
  const [showValidationTooltip, setShowValidationTooltip] = useState(false);

  const { ready: pyodideReady, validate, translate, render } = usePyodide();

  // Fetch repo file tree
  const fetchTree = useCallback(async function fetchTreeInner(path = ""): Promise<TreeNode[]> {
    const res = await fetch(
      `/api/github/repos/${owner}/${repo}/contents/${path}`
    );
    if (!res.ok) return [];
    const items: GitHubFile[] = await res.json();

    const nodes: TreeNode[] = [];
    for (const item of items.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
    )) {
      if (item.type === "dir") {
        const children = await fetchTreeInner(item.path);
        nodes.push({ name: item.name, path: item.path, type: "dir", children });
      } else {
        nodes.push({ name: item.name, path: item.path, type: "file" });
      }
    }
    return nodes;
  }, [owner, repo]);

  useEffect(() => {
    fetchTree().then((nodes) => {
      setTree(nodes);
      setLoadingTree(false);
    });
  }, [fetchTree]);

  // Fetch file content when selected
  async function handleSelectFile(path: string) {
    setSelectedFile(path);

    // If we already have content in memory, use it (might be edited)
    if (path in repoFiles) {
      setFileContent(repoFiles[path]);
      return;
    }

    setLoadingFile(true);
    try {
      const res = await fetch(
        `/api/github/repos/${owner}/${repo}/contents/${path}`
      );
      if (!res.ok) throw new Error("Failed to fetch file");
      const data = await res.json();
      const content = decodeBase64Utf8(data.content);
      setFileContent(content);
      setRepoFiles((prev) => ({ ...prev, [path]: content }));
    } catch {
      setFileContent("// Error loading file");
    } finally {
      setLoadingFile(false);
    }
  }

  // Collect all file paths from the tree
  function collectFilePaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    for (const node of nodes) {
      if (node.type === "file") {
        paths.push(node.path);
      } else if (node.children) {
        paths.push(...collectFilePaths(node.children));
      }
    }
    return paths;
  }

  // Fetch a single file's content from GitHub (base64 decoded)
  async function fetchFileContent(path: string): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/github/repos/${owner}/${repo}/contents/${path}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.content) return null;
      return decodeBase64Utf8(data.content);
    } catch {
      return null;
    }
  }

  // Run validation (uses repoFilesRef to avoid stale closure)
  const runValidation = useCallback(async () => {
    if (!pyodideReady) return;

    setValidating(true);
    try {
      const allPaths = collectFilePaths(tree);
      const currentFiles = repoFilesRef.current;

      const missing = allPaths.filter((p) => !(p in currentFiles));
      const fetchedMap: Record<string, string> = {};
      const fetched = await Promise.all(
        missing.map(async (p) => ({ path: p, content: await fetchFileContent(p) }))
      );
      for (const { path, content } of fetched) {
        if (content !== null) {
          fetchedMap[path] = content;
        }
      }

      // Only merge newly fetched files — use functional update to avoid
      // overwriting concurrent state changes (e.g. from agent file writes)
      if (Object.keys(fetchedMap).length > 0) {
        setRepoFiles((prev) => ({ ...prev, ...fetchedMap }));
      }

      // Build complete file map for validation using latest ref + fetched
      const allFiles = { ...repoFilesRef.current, ...fetchedMap };
      const result = await validate(allFiles);
      setValidationResult(result);
    } catch (e) {
      setValidationResult({
        valid: false,
        error: e instanceof Error ? e.message : "Validation failed",
        error_type: "Error",
      });
    } finally {
      setValidating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pyodideReady, tree, validate]);

  // Auto-validate when pyodide is ready and tree is loaded (initial load only)
  useEffect(() => {
    if (pyodideReady && tree.length > 0 && !validationResult && !validating) {
      runValidation();
    }
  }, [pyodideReady, tree, validationResult, validating, runValidation]);

  // Handle editor changes — mark file dirty, invalidate validation
  function handleEditorChange(val: string) {
    if (!selectedFile) return;

    setFileContent(val);
    setRepoFiles((prev) => ({ ...prev, [selectedFile]: val }));
    setDirtyFiles((prev) => new Set(prev).add(selectedFile));
    // Invalidate validation so translate is disabled until next save
    setValidationResult(null);
  }

  // Save = validate the current in-memory state
  async function handleSave() {
    if (dirtyFiles.size === 0) return;

    // Move dirty files to unpushed, clear dirty
    setUnpushedFiles((prev) => {
      const next = new Set(prev);
      for (const f of dirtyFiles) next.add(f);
      return next;
    });
    setDirtyFiles(new Set());

    // Run validation
    await runValidation();
  }

  // Push saved changes to GitHub
  async function handlePush() {
    if (unpushedFiles.size === 0) return;
    setPushing(true);

    try {
      for (const path of unpushedFiles) {
        const content = repoFiles[path];
        if (content === undefined) continue;

        // Get current SHA
        let sha: string | undefined;
        try {
          const getRes = await fetch(
            `/api/github/repos/${owner}/${repo}/contents/${path}`
          );
          if (getRes.ok) {
            const existing = await getRes.json();
            sha = existing.sha;
          }
        } catch {
          // New file
        }

        const res = await fetch(
          `/api/github/repos/${owner}/${repo}/contents/${path}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Update ${path}`,
              content: btoa(unescape(encodeURIComponent(content))),
              ...(sha ? { sha } : {}),
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || `Failed to push ${path}`);
        }
      }

      setUnpushedFiles(new Set());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  // Callback for ChatPanel when assistant writes a file.
  // The write_file tool already commits directly to GitHub,
  // so we only update local state — do NOT mark as unpushed.
  function handleAssistantFileWrite(path: string, content: string) {
    // Update ref immediately so runValidation sees the new content
    // (the ref normally lags behind state by one render cycle)
    repoFilesRef.current = { ...repoFilesRef.current, [path]: content };
    setRepoFiles((prev) => ({ ...prev, [path]: content }));
    // If this is the currently selected file, update the editor
    if (path === selectedFile) {
      setFileContent(content);
    }
    // Invalidate validation and auto-revalidate
    setValidationResult(null);
    // Refresh the tree in case a new file was created
    fetchTree().then(setTree);
    // Auto-validate after state settles
    setTimeout(() => runValidation(), 0);
  }

  // Render a sentence via Pyodide
  const handleRender = useCallback(
    async (
      sentenceType: string,
      data: Record<string, unknown>
    ): Promise<string | null> => {
      try {
        const result = await render({ sentenceType, data });
        return result.rendered ?? null;
      } catch {
        return null;
      }
    },
    [render]
  );

  const hasDirtyFiles = dirtyFiles.size > 0;
  const hasUnpushedFiles = unpushedFiles.size > 0;

  // Validation indicator
  const validationDot = validating
    ? "bg-yellow-400 animate-pulse"
    : validationResult?.valid
      ? "bg-green-500"
      : validationResult
        ? "bg-red-500"
        : "bg-gray-300";

  const validationTooltipText = validating
    ? "Validating..."
    : validationResult?.valid
      ? `${validationResult.name} (${validationResult.language}) — ${validationResult.sentence_types?.length ?? 0} sentence type${(validationResult.sentence_types?.length ?? 0) !== 1 ? "s" : ""}`
      : validationResult
        ? `${validationResult.error_type}: ${validationResult.error}`
        : "Not yet validated";

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">
            {owner}/{repo}
          </h1>
          {/* Validation indicator */}
          <div
            className="relative"
            onMouseEnter={() => setShowValidationTooltip(true)}
            onMouseLeave={() => setShowValidationTooltip(false)}
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${validationDot}`} />
            {showValidationTooltip && (
              <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{validationTooltipText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasDirtyFiles || validating}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              hasDirtyFiles
                ? "bg-gray-900 text-white hover:bg-gray-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            } disabled:opacity-50`}
          >
            {validating ? "Validating..." : hasDirtyFiles ? `Save (${dirtyFiles.size})` : "Saved"}
          </button>
          <button
            onClick={handlePush}
            disabled={!hasUnpushedFiles || hasDirtyFiles || pushing}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              hasUnpushedFiles && !hasDirtyFiles
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            } disabled:opacity-50`}
          >
            {pushing ? "Pushing..." : hasUnpushedFiles ? `Push (${unpushedFiles.size})` : "Pushed"}
          </button>
        </div>
      </div>

      {/* Main layout: Chat (left) | Tabbed panel (right) */}
      <div className="grid grid-cols-2 gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* Left: Chat assistant (always visible) */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <ChatPanel
            owner={owner}
            repo={repo}
            tree={tree}
            selectedFile={selectedFile}
            validationResult={validationResult}
            onFileWrite={handleAssistantFileWrite}
            onRender={handleRender}
            activeTab={rightTab}
          />
        </div>

        {/* Right: tabbed panel */}
        <div className="flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 shrink-0">
            {(["editor", "builder", "translate"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors capitalize ${
                  rightTab === tab
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === "editor" && (
              <div className="flex h-full">
                {/* File tree */}
                <div className="w-48 shrink-0 border-r border-gray-200 p-2 overflow-y-auto">
                  <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Files
                  </h2>
                  {loadingTree ? (
                    <p className="text-xs text-gray-400">Loading...</p>
                  ) : (
                    <FileTree
                      nodes={tree}
                      onSelectFile={handleSelectFile}
                      selectedPath={selectedFile ?? undefined}
                    />
                  )}
                </div>
                {/* Code editor */}
                <div className="flex-1 min-w-0">
                  {selectedFile ? (
                    loadingFile ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-gray-400">Loading file...</p>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col">
                        <div className="flex items-center border-b border-gray-200 px-3 py-1.5 shrink-0">
                          <span className="text-xs text-gray-500 truncate">
                            {selectedFile}
                            {dirtyFiles.has(selectedFile) && (
                              <span className="ml-1 text-amber-500">*</span>
                            )}
                          </span>
                        </div>
                        <div className="flex-1 min-h-0">
                          <CodeEditor
                            value={fileContent}
                            language={getLanguageFromPath(selectedFile)}
                            onChange={handleEditorChange}
                            validationResult={validationResult}
                            filePath={selectedFile}
                          />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-gray-400">
                        Select a file to edit
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === "builder" && (
              <SentenceBuilder
                validationResult={validationResult}
                validating={validating}
                onRender={handleRender}
              />
            )}

            {rightTab === "translate" && (
              <div className="h-full overflow-y-auto">
                <TranslatePanel
                  validationResult={validationResult}
                  onTranslate={translate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
