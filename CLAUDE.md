# Company Research Agent

## Project Overview

Company research agent that takes a domain, enriches it with GitHub + Hacker News data, scores it with an LLM, and returns a structured report.

## Tech Stack

- Node.js + TypeScript (strict mode)
- Trigger.dev v3 — task orchestration
- Vercel AI SDK (`ai` + `@ai-sdk/google`) — LLM interactions
- Express — HTTP API
- Zod — validation everywhere

## Architecture

Single Trigger.dev orchestrator (`researchCompany`) fans out to parallel enrichment subtasks (`fetchGitHub`, `fetchHackerNews`), collects results, passes to `analyzeWithLLM`, assembles final `CompanyReport`.

Express server exposes `POST /api/research` (trigger) and `GET /api/research/:runId` (status/results).

## Key Conventions

- **No hardcoded URLs.** All API base URLs live in `src/config.ts` via env vars. Never write `fetch("https://...")` directly.
- **Max type safety.** Discriminated unions for results (`EnrichmentResult<T>`), Zod schemas for all runtime validation, no `any` types.
- **Centralized config.** All env vars validated with Zod at startup in `src/config.ts`. Other files import from config, never read `process.env`.
- **Typed errors.** Subtasks return `{ success: false, error: string }`, never throw. Orchestrator always succeeds with partial data.
- **ESM imports.** Use `.js` extensions in imports (e.g., `from "../config.js"`).

## Commands

- `npm run dev` — start Express server
- `npm run dev:trigger` — start Trigger.dev dev server (run in separate terminal)
- `npx tsc --noEmit` — type check

## File Structure

```
src/config.ts                  — Zod-validated centralized config
src/types.ts                   — All shared types, Zod schemas, discriminated unions
src/server.ts                  — Express app setup + router mount + listen
src/router.ts                  — All endpoint definitions
src/controllers/
  research.ts                  — Handler functions for research endpoints
src/service/
  trigger-service.ts           — Business logic (GitHub, HN, LLM, helpers)
src/lib/
  llm.ts                       — AI SDK getModel() factory
src/util/
  http.ts                      — Generic fetchJson wrapper + HttpError
src/trigger/
  fetch-github.ts              — GitHub enrichment subtask (thin wrapper)
  fetch-hackernews.ts          — HN enrichment subtask (thin wrapper)
  analyze-with-llm.ts          — LLM analysis subtask (thin wrapper)
  research-company.ts          — Orchestrator task
trigger.config.ts              — Trigger.dev config (handled by Trigger CLI, not tsc)
```
