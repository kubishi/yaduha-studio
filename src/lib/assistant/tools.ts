/**
 * Tool definitions for the AI assistant (Anthropic format)
 * and execution logic that calls the GitHub API proxy.
 */

/** Decode Base64 string as UTF-8. */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export interface ToolContext {
  owner: string;
  repo: string;
}

// Anthropic tool definitions
export const TOOL_DEFINITIONS = [
  {
    name: "list_files",
    description:
      "List files and directories in the user's language project repository. Returns names and types (file/dir).",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Directory path to list (relative to repo root). Omit or use empty string for root.",
        },
      },
      required: [],
    },
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file from the user's language project repository.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to repo root (e.g. 'yaduha_ovp/__init__.py').",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or update a file in the user's language project repository. This commits the change directly to the default branch.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to repo root.",
        },
        content: {
          type: "string",
          description: "The full file content to write.",
        },
        message: {
          type: "string",
          description: "Commit message for this change.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "read_framework_file",
    description:
      "Read a file from the yaduha-2 framework repository (read-only reference). Use this to look up framework source code, base classes, or the yaduha-ovp example package.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "File path relative to the yaduha-2 repo root. Key files: 'yaduha/language/__init__.py' (Sentence base class), 'yaduha/loader.py' (validation logic). For the example package: use repo 'yaduha-ovp' with path 'yaduha_ovp/__init__.py'.",
        },
        repo: {
          type: "string",
          description:
            "Which framework repo to read from: 'yaduha-2' (default) or 'yaduha-ovp'.",
        },
      },
      required: ["path"],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, string>,
  context: ToolContext
): Promise<string> {
  switch (name) {
    case "list_files":
      return listFiles(context, input.path || "");
    case "read_file":
      return readFile(context, input.path);
    case "write_file":
      return writeFile(context, input.path, input.content, input.message);
    case "read_framework_file":
      return readFrameworkFile(input.path, input.repo || "yaduha-2");
    default:
      return `Unknown tool: ${name}`;
  }
}

async function listFiles(ctx: ToolContext, path: string): Promise<string> {
  const url = `/api/github/repos/${ctx.owner}/${ctx.repo}/contents/${path}`;
  const res = await fetch(url);
  if (!res.ok) return `Error listing files: ${res.status}`;

  const items = await res.json();
  if (!Array.isArray(items)) return "Path is a file, not a directory.";

  const lines = items
    .sort((a: { type: string; name: string }, b: { type: string; name: string }) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
    )
    .map((item: { name: string; type: string }) =>
      `${item.type === "dir" ? "📁" : "📄"} ${item.name}`
    );
  return lines.join("\n");
}

async function readFile(ctx: ToolContext, path: string): Promise<string> {
  const url = `/api/github/repos/${ctx.owner}/${ctx.repo}/contents/${path}`;
  const res = await fetch(url);
  if (!res.ok) return `Error reading file: ${res.status}`;

  const data = await res.json();
  if (!data.content) return "File has no content (may be a directory).";
  return decodeBase64Utf8(data.content);
}

async function writeFile(
  ctx: ToolContext,
  path: string,
  content: string,
  message?: string
): Promise<string> {
  const url = `/api/github/repos/${ctx.owner}/${ctx.repo}/contents/${path}`;

  // Get current SHA if file exists (needed for updates)
  let sha: string | undefined;
  try {
    const getRes = await fetch(url);
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
  } catch {
    // File doesn't exist yet, that's fine
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Update ${path}`,
      content: btoa(unescape(encodeURIComponent(content))),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return `Error writing file: ${err.message || res.status}`;
  }

  return `Successfully wrote ${path}`;
}

async function readFrameworkFile(path: string, repo: string): Promise<string> {
  const url = `/api/github/repos/kubishi/${repo}/contents/${path}`;
  const res = await fetch(url);
  if (!res.ok) return `Error reading framework file: ${res.status}`;

  const data = await res.json();
  if (!data.content) return "File has no content.";
  return decodeBase64Utf8(data.content);
}
