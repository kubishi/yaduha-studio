"use client";

import { useEffect, useState } from "react";

interface AuthState {
  authenticated: boolean;
  user: string | null;
  loading: boolean;
}

export function useAuth(): AuthState & { logout: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    user: null,
    loading: true,
  });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setState({
          authenticated: data.authenticated ?? false,
          user: data.user ?? null,
          loading: false,
        });
      })
      .catch(() => {
        setState({ authenticated: false, user: null, loading: false });
      });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ authenticated: false, user: null, loading: false });
    window.location.href = "/";
  }

  return { ...state, logout };
}
