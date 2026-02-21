# Yaduha Studio

A web IDE for building [yaduha](https://github.com/kubishi/yaduha-2) language packages — AI-assisted rule-based machine translation for low-resource languages.

Linguists describe grammar rules in natural language through a chat assistant. The agent writes Python code behind the scenes, validates it via in-browser Pyodide, and a live sentence builder hot-reloads so users can immediately test translations.

## Features

- **AI Assistant** — LLM-powered chat that reads, writes, and validates language package code
- **Sentence Builder** — Interactive form generated from Pydantic JSON schemas, renders target-language sentences in real time
- **Code Editor** — Monaco-based editor for direct file editing
- **Translation** — Translate English sentences using the language package's grammar rules
- **GitHub Integration** — OAuth login, repo management, fork templates, push changes

## Stack

Next.js 16 on Cloudflare Workers (via [OpenNext](https://github.com/opennextjs/opennextjs-cloudflare)). Pyodide for in-browser Python validation and rendering. Zustand for client state. Anthropic API for the assistant.

## Development

```bash
npm install
npm run dev
```

Requires a `.dev.vars` file with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, and optionally `ANTHROPIC_API_KEY`.

## Deploy

```bash
npm run deploy
```

Deploys to Cloudflare Workers. Set secrets via `wrangler secret put`.
