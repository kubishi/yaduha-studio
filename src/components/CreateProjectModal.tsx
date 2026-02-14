"use client";

import { useState } from "react";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (owner: string, repo: string) => void;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pyIdentifier(code: string): string {
  return code.replace(/-/g, "_");
}

function generatePyprojectToml(code: string, name: string): string {
  const pyCode = pyIdentifier(code);
  return `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "yaduha-${code}"
version = "0.1.0"
description = "${name} language package for the Yaduha framework"
requires-python = ">=3.10"
dependencies = ["yaduha>=0.3"]

[project.entry-points."yaduha.languages"]
${code} = "yaduha_${pyCode}:language"
`;
}

function generateInitPy(code: string, name: string): string {
  return `from yaduha import Language, Sentence
from pydantic import Field


class SimpleSentence(Sentence):
    """A basic sentence with a subject and verb."""

    subject: str = Field(description="The subject of the sentence")
    verb: str = Field(description="The verb/action")

    def __str__(self) -> str:
        return f"{self.subject} {self.verb}"

    @classmethod
    def get_examples(cls):
        return [
            ("I sleep.", cls(subject="I", verb="sleep")),
            ("You run.", cls(subject="you", verb="run")),
        ]


language = Language(
    code="${code}",
    name="${name}",
    sentence_types=(SimpleSentence,),
)
`;
}

export default function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const [langName, setLangName] = useState("");
  const [langCode, setLangCode] = useState("");
  const [repoName, setRepoName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveRepoName = repoName || (langCode ? `yaduha-${langCode}` : "");

  function handleCodeChange(code: string) {
    const slugged = slugify(code);
    setLangCode(slugged);
    if (!repoName) {
      // Keep repoName empty so the placeholder auto-generates
    }
  }

  async function handleCreate() {
    if (!langName.trim() || !langCode.trim()) return;

    setCreating(true);
    setError(null);

    const finalRepoName = effectiveRepoName;
    const pyCode = pyIdentifier(langCode);

    try {
      // 1. Create GitHub repo
      const createRes = await fetch("/api/github/user/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalRepoName,
          description: `${langName} language package for the Yaduha framework`,
          auto_init: false,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(
          data.message || data.errors?.[0]?.message || "Failed to create repository"
        );
      }

      const repoData = await createRes.json();
      const owner = repoData.owner.login;

      // 2. Push pyproject.toml (first file creates the initial commit)
      const pyprojectContent = generatePyprojectToml(langCode, langName);
      const pyprojectRes = await fetch(
        `/api/github/repos/${owner}/${finalRepoName}/contents/pyproject.toml`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Initial project scaffold",
            content: btoa(pyprojectContent),
          }),
        }
      );

      if (!pyprojectRes.ok) {
        throw new Error("Failed to create pyproject.toml");
      }

      // 3. Push __init__.py
      const initContent = generateInitPy(langCode, langName);
      const initRes = await fetch(
        `/api/github/repos/${owner}/${finalRepoName}/contents/yaduha_${pyCode}/__init__.py`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Add language module template",
            content: btoa(initContent),
          }),
        }
      );

      if (!initRes.ok) {
        throw new Error("Failed to create __init__.py");
      }

      onCreated(owner, finalRepoName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Create Language Project
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language Name
            </label>
            <input
              type="text"
              value={langName}
              onChange={(e) => setLangName(e.target.value)}
              placeholder="e.g., Owens Valley Paiute"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language Code
            </label>
            <input
              type="text"
              value={langCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g., ovp"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Short identifier (ISO 639-3 recommended)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository Name
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder={langCode ? `yaduha-${langCode}` : "yaduha-..."}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !langName.trim() || !langCode.trim()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
