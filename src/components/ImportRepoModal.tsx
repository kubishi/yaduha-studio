"use client";

import { useEffect, useState } from "react";
import { useProjects } from "@/lib/store";

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  updated_at: string;
}

interface ImportRepoModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (owner: string, repo: string) => void;
}

export default function ImportRepoModal({
  open,
  onClose,
  onImported,
}: ImportRepoModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { hasProject } = useProjects();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    fetch("/api/github/user/repos?sort=updated&per_page=100")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch repos");
        return res.json();
      })
      .then((data) => setRepos(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Import from GitHub
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-3">
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto px-5 pb-4">
          {loading && (
            <p className="py-4 text-center text-sm text-gray-400">
              Loading repositories...
            </p>
          )}
          {error && (
            <p className="py-4 text-center text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">
              No repositories found.
            </p>
          )}
          {!loading &&
            !error &&
            filtered.map((repo) => {
              const alreadyImported = hasProject(
                repo.owner.login,
                repo.name
              );
              return (
                <button
                  key={repo.full_name}
                  disabled={alreadyImported}
                  onClick={() => {
                    onImported(repo.owner.login, repo.name);
                  }}
                  className={`w-full text-left rounded-md px-3 py-2.5 mb-1 transition-colors ${
                    alreadyImported
                      ? "opacity-50 cursor-not-allowed bg-gray-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {repo.full_name}
                      </p>
                      {repo.description && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    {alreadyImported && (
                      <span className="ml-2 text-xs text-gray-400">
                        Already added
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
