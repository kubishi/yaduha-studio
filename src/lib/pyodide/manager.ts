/**
 * Main-thread API for communicating with the Pyodide Web Worker.
 * Returns Promises so callers can `await` validation results.
 */

export interface TranslateResult {
  ok: boolean;
  target?: string;
  back_translation?: string;
  sentences?: Record<string, unknown>[];
  sentence_types?: string[];
  error?: string;
  error_type?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type WorkerMessage =
  | { type: "ready" }
  | { type: "result"; data: any }
  | { type: "error"; message: string };

export interface SentenceExample {
  english: string;
  structured: Record<string, unknown>;
  target: string;
}

export interface SentenceSchema {
  name: string;
  json_schema: Record<string, unknown>;
  examples: SentenceExample[];
}

export interface ValidationResult {
  valid: boolean;
  language?: string;
  name?: string;
  sentence_types?: string[];
  schemas?: Record<string, SentenceSchema>;
  error?: string;
  error_type?: string;
}

export class PyodideManager {
  private worker: Worker | null = null;
  private ready = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private pendingResolve: ((result: any) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  start() {
    if (this.worker) return;

    this.worker = new Worker(
      new URL("./worker.ts", import.meta.url),
      { type: "classic" }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;

      switch (msg.type) {
        case "ready":
          this.ready = true;
          this.resolveReady();
          break;

        case "result":
          this.pendingResolve?.(msg.data);
          this.pendingResolve = null;
          this.pendingReject = null;
          break;

        case "error":
          if (this.pendingReject) {
            this.pendingReject(new Error(msg.message));
            this.pendingResolve = null;
            this.pendingReject = null;
          }
          break;
      }
    };
  }

  async validate(files: Record<string, string>): Promise<ValidationResult> {
    if (!this.worker) {
      throw new Error("Worker not started. Call start() first.");
    }

    await this.readyPromise;

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.worker!.postMessage({ type: "validate", files });
    });
  }

  async translate(params: {
    english: string;
    provider: string;
    model: string;
    apiKey?: string;
  }): Promise<TranslateResult> {
    if (!this.worker) {
      throw new Error("Worker not started. Call start() first.");
    }

    await this.readyPromise;

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.worker!.postMessage({
        type: "translate",
        ...params,
        origin: window.location.origin,
      });
    });
  }

  isReady() {
    return this.ready;
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
