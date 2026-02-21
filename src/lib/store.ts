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

// --- Chat sessions store (localStorage-persisted) ---

export interface DisplayMessage {
  type: "user" | "assistant" | "tool-activity";
  content: string;
}

export interface ChatSession {
  id: string;
  repoKey: string; // "owner/repo"
  name: string;
  displayMessages: DisplayMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiMessages: any[];
  createdAt: string;
  updatedAt: string;
}

interface ChatSessionsState {
  sessions: ChatSession[];
  activeSessionId: Record<string, string>; // repoKey → sessionId

  getSessions: (repoKey: string) => ChatSession[];
  getActiveSession: (repoKey: string) => ChatSession | null;
  createSession: (repoKey: string, name?: string) => string; // returns new session id
  setActiveSession: (repoKey: string, sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  deleteSession: (repoKey: string, sessionId: string) => void;
  updateSessionMessages: (
    sessionId: string,
    displayMessages: DisplayMessage[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiMessages: any[]
  ) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useChatSessions = create<ChatSessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: {},

      getSessions: (repoKey) =>
        get().sessions.filter((s) => s.repoKey === repoKey),

      getActiveSession: (repoKey) => {
        const activeId = get().activeSessionId[repoKey];
        if (!activeId) return null;
        return get().sessions.find((s) => s.id === activeId) ?? null;
      },

      createSession: (repoKey, name) => {
        const id = generateId();
        const count = get().sessions.filter((s) => s.repoKey === repoKey).length;
        const session: ChatSession = {
          id,
          repoKey,
          name: name ?? `Chat ${count + 1}`,
          displayMessages: [],
          apiMessages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          sessions: [...state.sessions, session],
          activeSessionId: { ...state.activeSessionId, [repoKey]: id },
        }));
        return id;
      },

      setActiveSession: (repoKey, sessionId) =>
        set((state) => ({
          activeSessionId: { ...state.activeSessionId, [repoKey]: sessionId },
        })),

      renameSession: (sessionId, name) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, name } : s
          ),
        })),

      deleteSession: (repoKey, sessionId) =>
        set((state) => {
          const remaining = state.sessions.filter((s) => s.id !== sessionId);
          const newActive = { ...state.activeSessionId };
          if (newActive[repoKey] === sessionId) {
            const repoSessions = remaining.filter((s) => s.repoKey === repoKey);
            newActive[repoKey] = repoSessions.length > 0 ? repoSessions[repoSessions.length - 1].id : "";
          }
          return { sessions: remaining, activeSessionId: newActive };
        }),

      updateSessionMessages: (sessionId, displayMessages, apiMessages) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, displayMessages, apiMessages, updatedAt: new Date().toISOString() }
              : s
          ),
        })),
    }),
    { name: "yaduha-studio-chat-sessions" }
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
