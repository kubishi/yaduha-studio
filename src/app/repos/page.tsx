"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/store";
import ImportRepoModal from "@/components/ImportRepoModal";
import CreateProjectModal from "@/components/CreateProjectModal";

export default function ReposPage() {
  const router = useRouter();
  const { projects, addProject, removeProject } = useProjects();
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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

      {projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-500 mb-1">No projects yet.</p>
          <p className="text-sm text-gray-400 mb-6">
            Create a new language project or import one from GitHub to get
            started.
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
