# Company Research Agent — Design Spec

## Overview

A company research agent that takes a company domain as input, enriches it with data from public APIs (GitHub, Hacker News), uses an LLM to analyze and score the lead, and produces a structured report.

**Tech stack:** Node.js, TypeScript, Trigger.dev v3 (orchestration), Vercel AI SDK (LLM), Express (HTTP), Zod (validation).

## Project Structure

```
company-score/
├── src/
│   ├── config.ts                  # Centralized, Zod-validated config
│   ├── trigger/
│   │   ├── research-company.ts    # Orchestrator task
│   │   ├── fetch-github.ts        # GitHub enrichment subtask
│   │   ├── fetch-hackernews.ts    # HN enrichment subtask
│   │   └── analyze-with-llm.ts    # LLM analysis subtask
│   ├── server.ts                  # Express app (POST + GET endpoints)
│   └── types.ts                   # Shared types, Zod schemas, discriminated unions
├── trigger.config.ts              # Minimal — imports from src/config.ts
├── .env                           # API keys (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Centralized Config

All configuration lives in `src/config.ts`. Env vars are validated at startup with Zod — the app crashes early if misconfigured. No hardcoded URLs anywhere in business logic.

```typescript
const config = {
  trigger: { /* project ref */ },
  llm: {
    provider: string,    // "google" default, swappable
    model: string,       // defaults to "gemini-2.0-flash"
    apiKey: string,
  },
  server: {
    port: number,        // defaults to 3000
  },
  apis: {
    github: {
      baseUrl: string,   // defaults to "https://api.github.com"
    },
    hackerNews: {
      baseUrl: string,   // defaults to "https://hn.algolia.com/api/v1"
    },
  },
};
```

### Environment Variables

| Variable | Required | Default |
|---|---|---|
| `TRIGGER_SECRET_KEY` | Yes | — |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | — |
| `LLM_MODEL` | No | `gemini-2.0-flash` |
| `PORT` | No | `3000` |
| `GITHUB_API_BASE_URL` | No | `https://api.github.com` |
| `HN_API_BASE_URL` | No | `https://hn.algolia.com/api/v1` |

## HTTP API

### `POST /api/research`

**Request body:** `{ "domain": "stripe.com" }` — validated with Zod.

**Response:** `{ "runId": "run_abc123", "status": "EXECUTING" }`

Triggers the `researchCompany` orchestrator task and returns immediately.

### `GET /api/research/:runId`

**Response (in progress):** `{ "runId": "run_abc123", "status": "EXECUTING" }`

**Response (complete):**
```json
{
  "runId": "run_abc123",
  "status": "COMPLETED",
  "report": { ... }
}
```

Returns current status by calling Trigger.dev's `runs.retrieve()`. Client polls if it wants to wait.

**Error responses:** 400 for invalid input, 404 for unknown run IDs, 500 for unexpected errors. All typed.

## Task Architecture

### Orchestrator: `researchCompany`

**Input:** `{ domain: string }`
**Output:** `CompanyReport`

1. Extracts org name from domain by taking everything before the first dot (`"stripe.com"` → `"stripe"`, `"my-company.co.uk"` → `"my-company"`).
2. Fans out `fetchGitHub` and `fetchHackerNews` in parallel via `batch.triggerAndWait`.
3. Collects results — each is a discriminated union (`success` or `failure`).
4. Passes all collected data to `analyzeWithLLM` via `triggerAndWait`.
5. Assembles and returns the final `CompanyReport`.

If both enrichment sources fail, still calls the LLM with empty data. The LLM will score accordingly (low score, cold lead). No hard failure.

### Subtask: `fetchGitHub`

**Input:** `{ orgName: string }`
**Output:** `{ success: true, data: GitHubData } | { success: false, error: string }`

- Fetches `${baseUrl}/orgs/${orgName}` for org info (description, public repo count).
- Fetches `${baseUrl}/orgs/${orgName}/repos?sort=stars&per_page=10` for top repos.
- Returns: org description, public repo count, top 10 repos (name, stars, language, description).
- Rate limit 403 → returns failure immediately (no retry).

**Retry:** `{ limit: 2, minTimeoutInMs: 1000, factor: 2 }` for transient errors.

### Subtask: `fetchHackerNews`

**Input:** `{ domain: string }`
**Output:** `{ success: true, data: HackerNewsData } | { success: false, error: string }`

- Fetches `${baseUrl}/search?query=${domain}&tags=story&hitsPerPage=10` for top stories.
- Returns: top 10 stories sorted by points (title, points, URL, date).

**Retry:** `{ limit: 2, minTimeoutInMs: 1000, factor: 2 }` for transient errors.

### Subtask: `analyzeWithLLM`

**Input:** `{ domain: string, github: GitHubData | null, hackerNews: HackerNewsData | null }`
**Output:** `{ success: true, data: LLMAnalysis } | { success: false, error: string }`

- Uses Vercel AI SDK's `generateObject` with a Zod schema to produce structured output.
- LLM provider is configurable (defaults to Google Gemini via `@ai-sdk/google`).
- Output schema:
  ```typescript
  {
    score: number,              // 0-100
    analysis: string,           // short paragraph
    recommendation: "hot" | "warm" | "cold"
  }
  ```
- Zod validation on output means malformed LLM responses are caught as type errors.

**Retry:** `{ limit: 2 }` for transient API failures.

## Type System

All types live in `src/types.ts`.

**Discriminated unions for enrichment results:**
```typescript
type EnrichmentResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Core types:**
- `GitHubData` — org info + top repos array
- `HackerNewsData` — stories array
- `LLMAnalysis` — score, analysis, recommendation
- `CompanyReport` — domain, enrichment results, LLM analysis, timestamp

**Zod schemas for:**
- Env var validation (config)
- HTTP request body validation (Express)
- LLM structured output (generateObject)

## Error Handling

| Layer | Strategy |
|---|---|
| Config | Zod validation at startup. App crashes early on bad config. |
| Express | Zod input validation. Typed error responses (400, 404, 500). |
| Enrichment subtasks | Try/catch internally. Return typed failure, never throw. Trigger.dev retries transient errors. |
| GitHub rate limits | 403 with rate limit headers → immediate failure return, no retry. |
| LLM subtask | Trigger.dev retries. Zod validates structured output. |
| Orchestrator | Always succeeds — works with partial data if sources fail. |

## What's Out of Scope

- Authentication / authorization on the Express endpoints
- Persistent storage / database
- UI / frontend
- Caching of enrichment results
- Additional data sources beyond GitHub and Hacker News
