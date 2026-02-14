"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CodeEditor, { getLanguageFromPath } from "@/components/CodeEditor";
import FileTree from "@/components/FileTree";
import ValidationPanel from "@/components/ValidationPanel";
import TranslatePanel from "@/components/TranslatePanel";
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

  // All files content for validation
  const [repoFiles, setRepoFiles] = useState<Record<string, string>>({});

  const { ready: pyodideReady, loading: pyodideLoading, validate, translate } = usePyodide();

  // Fetch repo file tree
  useEffect(() => {
    async function fetchTree(path = "") {
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
          const children = await fetchTree(item.path);
          nodes.push({ name: item.name, path: item.path, type: "dir", children });
        } else {
          nodes.push({ name: item.name, path: item.path, type: "file" });
        }
      }
      return nodes;
    }

    fetchTree().then((nodes) => {
      setTree(nodes);
      setLoadingTree(false);
    });
  }, [owner, repo]);

  // Fetch file content when selected
  async function handleSelectFile(path: string) {
    setSelectedFile(path);
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

  async function handleValidate() {
    setValidating(true);
    try {
      // Fetch ALL repo files, not just the ones opened in the editor
      const allPaths = collectFilePaths(tree);
      const allFiles: Record<string, string> = { ...repoFiles };

      // Fetch any files not already loaded
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          {owner}/{repo}
        </h1>
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
        <div className="col-span-6 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {selectedFile ? (
            loadingFile ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Loading file...</p>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-500">
                  {selectedFile}
                </div>
                <div className="flex-1">
                  <CodeEditor
                    value={fileContent}
                    language={getLanguageFromPath(selectedFile)}
                    onChange={(val) => {
                      setFileContent(val);
                      setRepoFiles((prev) => ({
                        ...prev,
                        [selectedFile]: val,
                      }));
                    }}
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

        {/* Right sidebar: validation + translate */}
        <div className="col-span-3 space-y-4 overflow-y-auto">
          <ValidationPanel
            result={validationResult}
            loading={validating}
            pyodideReady={pyodideReady}
            onValidate={handleValidate}
          />
          <TranslatePanel
            validationResult={validationResult}
            onTranslate={translate}
          />
        </div>
      </div>
    </div>
  );
}
