"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import ImportRepoModal from "@/components/ImportRepoModal";
import CreateProjectModal from "@/components/CreateProjectModal";

const TEMPLATES = [
  {
    owner: "kubishi",
    repo: "yaduha-ovp",
    description: "Owens Valley Paiute — example language package with SV and SVO sentence types",
  },
];

export default function ReposPage() {
  const router = useRouter();
  const { projects, addProject, removeProject } = useProjects();
  const { user } = useAuth();
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [forking, setForking] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    owner: string;
    repo: string;
  } | null>(null);

  function handleImported(owner: string, repo: string) {
    addProject(owner, repo);
    setShowImport(false);
    router.push(`/repos/${owner}/${repo}`);
  }

  function handleCreated(owner: string, repo: string) {
    addProject(owner, repo);
    setShowCreate(false);
    router.push(`/repos/${owner}/${repo}`);
  }

  function handleRemove(owner: string, repo: string) {
    removeProject(owner, repo);
    setConfirmRemove(null);
  }

  // Check if user already has this template (or a fork of it) in their projects
  function getExistingProject(templateRepo: string) {
    return projects.find((p) => p.repo === templateRepo);
  }

  async function handleFork(templateOwner: string, templateRepo: string) {
    const key = `${templateOwner}/${templateRepo}`;
    setForking(key);

    try {
      const res = await fetch(`/api/github/repos/${templateOwner}/${templateRepo}/forks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Fork failed (${res.status})`);
      }

      const fork = await res.json();
      const forkOwner = fork.owner?.login || user;
      const forkRepo = fork.name || templateRepo;

      addProject(forkOwner, forkRepo);
      router.push(`/repos/${forkOwner}/${forkRepo}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fork failed");
    } finally {
      setForking(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Your Projects</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Create Project
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Import from GitHub
          </button>
        </div>
      </div>

      {/* Templates */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Templates
        </h2>
        <div className="space-y-2">
          {TEMPLATES.map((tmpl) => {
            const existing = getExistingProject(tmpl.repo);
            const key = `${tmpl.owner}/${tmpl.repo}`;
            const isForkingThis = forking === key;

            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">
                    {tmpl.owner}/{tmpl.repo}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tmpl.description}
                  </p>
                </div>
                {existing ? (
                  <Link
                    href={`/repos/${existing.owner}/${existing.repo}`}
                    className="ml-4 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Open
                  </Link>
                ) : (
                  <button
                    onClick={() => handleFork(tmpl.owner, tmpl.repo)}
                    disabled={isForkingThis}
                    className="ml-4 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {isForkingThis ? "Forking..." : "Fork & Open"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* User projects */}
      {projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-500 mb-1">No projects yet.</p>
          <p className="text-sm text-gray-400 mb-6">
            Create a new language project, import one from GitHub, or fork a
            template above to get started.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Create Project
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Import from GitHub
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={`${project.owner}/${project.repo}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <Link
                href={`/repos/${project.owner}/${project.repo}`}
                className="flex-1 min-w-0 hover:underline"
              >
                <h3 className="font-medium text-gray-900">
                  {project.owner}/{project.repo}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Added {new Date(project.addedAt).toLocaleDateString()}
                </p>
              </Link>
              <button
                onClick={() =>
                  setConfirmRemove({
                    owner: project.owner,
                    repo: project.repo,
                  })
                }
                className="ml-4 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Remove project?
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              This will remove{" "}
              <span className="font-medium">
                {confirmRemove.owner}/{confirmRemove.repo}
              </span>{" "}
              from your local project list.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              The GitHub repository will not be deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleRemove(confirmRemove.owner, confirmRemove.repo)
                }
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportRepoModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={handleImported}
      />
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
