"use client";

import { useEffect, useRef, useState } from "react";
import { PyodideManager, type ValidationResult, type TranslateResult } from "@/lib/pyodide/manager";

export function usePyodide() {
  const managerRef = useRef<PyodideManager | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const manager = new PyodideManager();
    managerRef.current = manager;
    manager.start();

    // Poll for ready state
    const interval = setInterval(() => {
      if (manager.isReady()) {
        setReady(true);
        setLoading(false);
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      manager.terminate();
    };
  }, []);

  async function validate(
    files: Record<string, string>
  ): Promise<ValidationResult> {
    if (!managerRef.current) {
      throw new Error("Pyodide not initialized");
    }
    return managerRef.current.validate(files);
  }

  async function translate(params: {
    english: string;
    provider: string;
    model: string;
    apiKey?: string;
  }): Promise<TranslateResult> {
    if (!managerRef.current) {
      throw new Error("Pyodide not initialized");
    }
    return managerRef.current.translate(params);
  }

  return { ready, loading, validate, translate };
}
