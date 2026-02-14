"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  preferredProvider: "anthropic" | "openai";
  preferredModel: string;
  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setPreferredProvider: (provider: "anthropic" | "openai") => void;
  setPreferredModel: (model: string) => void;
  clearKeys: () => void;
}

// --- Projects store (localStorage-persisted) ---

export interface Project {
  owner: string;
  repo: string;
  addedAt: string;
}

interface ProjectsState {
  projects: Project[];
  addProject: (owner: string, repo: string) => void;
  removeProject: (owner: string, repo: string) => void;
  hasProject: (owner: string, repo: string) => boolean;
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      addProject: (owner, repo) => {
        const existing = get().projects;
        if (existing.some((p) => p.owner === owner && p.repo === repo)) return;
        set({ projects: [...existing, { owner, repo, addedAt: new Date().toISOString() }] });
      },
      removeProject: (owner, repo) =>
        set((state) => ({
          projects: state.projects.filter(
            (p) => !(p.owner === owner && p.repo === repo)
          ),
        })),
      hasProject: (owner, repo) =>
        get().projects.some((p) => p.owner === owner && p.repo === repo),
    }),
    { name: "yaduha-studio-projects" }
  )
);

// --- Settings store (localStorage-persisted) ---

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      anthropicKey: "",
      openaiKey: "",
      preferredProvider: "anthropic",
      preferredModel: "",
      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setPreferredProvider: (provider) => set({ preferredProvider: provider }),
      setPreferredModel: (model) => set({ preferredModel: model }),
      clearKeys: () => set({ anthropicKey: "", openaiKey: "" }),
    }),
    { name: "yaduha-studio-settings" }
  )
);
