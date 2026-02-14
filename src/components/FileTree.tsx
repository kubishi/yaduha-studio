"use client";

import { useState } from "react";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

interface FileTreeProps {
  nodes: TreeNode[];
  onSelectFile: (path: string) => void;
  selectedPath?: string;
}

function TreeItem({
  node,
  depth,
  onSelectFile,
  selectedPath,
}: {
  node: TreeNode;
  depth: number;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = node.path === selectedPath;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span className="text-xs">{expanded ? "▼" : "▶"}</span>
          <span>{node.name}/</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`flex w-full items-center rounded px-2 py-1 text-sm ${
        isSelected
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      {node.name}
    </button>
  );
}

export default function FileTree({
  nodes,
  onSelectFile,
  selectedPath,
}: FileTreeProps) {
  return (
    <div className="overflow-y-auto">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          onSelectFile={onSelectFile}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
