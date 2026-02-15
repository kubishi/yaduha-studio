"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CodeEditor, { getLanguageFromPath } from "@/components/CodeEditor";
import FileTree from "@/components/FileTree";
import ValidationPanel from "@/components/ValidationPanel";
import TranslatePanel from "@/components/TranslatePanel";
import ChatPanel from "@/components/ChatPanel";
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
  const [activeTab, setActiveTab] = useState<"tools" | "assistant">("tools");

  // Dirty = edited since last save/validate
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  // Unpushed = saved locally but not yet pushed to GitHub
  const [unpushedFiles, setUnpushedFiles] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);

  // All files content for validation
  const [repoFiles, setRepoFiles] = useState<Record<string, string>>({});

  const { ready: pyodideReady, validate, translate } = usePyodide();

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

  // Run validation
  const runValidation = useCallback(async () => {
    if (!pyodideReady) return;

    setValidating(true);
    try {
      const allPaths = collectFilePaths(tree);
      const allFiles: Record<string, string> = { ...repoFiles };

      const missing = allPaths.filter((p) => !(p in allFiles));
      const fetched = await Promise.all(
        missing.map(async (p) => ({ path: p, content: await fetchFileContent(p) }))
      );
      for (const { path, content } of fetched) {
        if (content !== null) {
          allFiles[path] = content;
        }
      }

      setRepoFiles(allFiles);
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

  // Callback for ChatPanel when assistant writes a file
  function handleAssistantFileWrite(path: string, content: string) {
    setRepoFiles((prev) => ({ ...prev, [path]: content }));
    // If this is the currently selected file, update the editor
    if (path === selectedFile) {
      setFileContent(content);
    }
    // Mark as dirty — same as a user edit
    setDirtyFiles((prev) => new Set(prev).add(path));
    // Invalidate validation
    setValidationResult(null);
    // Refresh the tree in case a new file was created
    fetchTree().then(setTree);
  }

  const hasDirtyFiles = dirtyFiles.size > 0;
  const hasUnpushedFiles = unpushedFiles.size > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          {owner}/{repo}
        </h1>
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

      <div className="grid grid-cols-12 gap-4" style={{ height: "calc(100vh - 200px)" }}>
        {/* File tree sidebar */}
        <div className="col-span-3 rounded-lg border border-gray-200 bg-white p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Files
          </h2>
          {loadingTree ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <FileTree
              nodes={tree}
              onSelectFile={handleSelectFile}
              selectedPath={selectedFile ?? undefined}
            />
          )}
        </div>

        {/* Editor */}
        <div className="col-span-5 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {selectedFile ? (
            loadingFile ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Loading file...</p>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                  <span className="text-xs text-gray-500">
                    {selectedFile}
                    {dirtyFiles.has(selectedFile) && (
                      <span className="ml-1 text-amber-500">*</span>
                    )}
                  </span>
                </div>
                <div className="flex-1">
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
                Select a file from the tree to start editing
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar: tabbed */}
        <div className="col-span-4 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("tools")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "tools"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Validate & Translate
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "assistant"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Assistant
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "tools" ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-0">
              <ValidationPanel
                result={validationResult}
                loading={validating}
              />
              <TranslatePanel
                validationResult={validationResult}
                onTranslate={translate}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <ChatPanel
                owner={owner}
                repo={repo}
                tree={tree}
                selectedFile={selectedFile}
                validationResult={validationResult}
                onFileWrite={handleAssistantFileWrite}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
