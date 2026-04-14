# Company Research Agent

A company research agent that takes a company domain as input, enriches it with data from public APIs (GitHub, Hacker News), uses an LLM to analyze and score the lead, and produces a structured report.

## Architecture

```
POST /api/research { domain: "stripe.com" }
  └── researchCompany (Trigger.dev orchestrator)
        ├── fetchGitHub      → GitHub org + repos data
        ├── fetchHackerNews  → HN mentions + stories
        └── analyzeWithLLM   → score (0-100), analysis, recommendation
```

**Tech stack:** Node.js, TypeScript, Trigger.dev v3, Vercel AI SDK, Express, Zod.

**Key design decisions:**
- Layered architecture — router, controllers, service layer, lib, and util directories with clear separation of concerns.
- Centralized config (`src/config.ts`) — all env vars, API base URLs, and retry settings validated with Zod at startup. No hardcoded values in business logic.
- LLM provider abstraction (`src/lib/llm.ts`) — service layer doesn't know which model or provider is configured. Swappable by changing one file.
- Typed error handling — enrichment functions return discriminated unions (`success`/`failure`), never throw. The orchestrator always completes, even with partial data.
- GitHub org discovery — uses GitHub Search API to find the correct org for a domain, not just the domain prefix.
- HN relevance filtering — LLM prompt instructs the model to ignore stories about similarly-named but different companies.

## File Structure

```
src/
  config.ts              — Zod-validated centralized config
  types.ts               — All shared types, Zod schemas, discriminated unions
  server.ts              — Express app setup + router mount + listen
  router.ts              — All endpoint definitions
  controllers/
    research.ts          — Handler functions for research endpoints
  service/
    trigger-service.ts   — Business logic + Trigger.dev task definitions
  lib/
    llm.ts               — AI SDK getModel() factory
  util/
    http.ts              — Generic fetchJson wrapper + HttpError
trigger.config.ts        — Trigger.dev config (points to src/service)
```

## Setup

### Prerequisites

- Node.js 20+
- A [Trigger.dev](https://trigger.dev) account (free tier works)
- A Google Gemini API key

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
TRIGGER_SECRET_KEY=your-trigger-secret-key       # required
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key  # required
LLM_MODEL=gemini-3-flash-preview                   # optional
PORT=3000                                          # optional
GITHUB_API_BASE_URL=https://api.github.com         # optional
HN_API_BASE_URL=https://hn.algolia.com/api/v1     # optional
```

### Running

Start both servers with a single command:

```bash
npm run dev
```

This runs Trigger.dev and the Express server concurrently. You can also run them separately:

```bash
npm run dev:trigger   # Trigger.dev only
npm run dev:server    # Express only
```

## Usage

### Web UI

Open [http://localhost:3000](http://localhost:3000) in your browser. Enter a company domain (e.g. `stripe.com`) and click "Research". Results appear automatically when the analysis is complete.

### API

**Trigger a research run:**

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"domain": "stripe.com"}'
```

Response: `{ "runId": "run_abc123", "status": "QUEUED" }`

**Check status / get results:**

```bash
curl http://localhost:3000/api/research/run_abc123
```

## Improvements Given More Time

- **Add more data sources** — LinkedIn, Crunchbase, BuiltWith for tech stack detection
- **Caching layer** — cache enrichment results to avoid redundant API calls and stay within GitHub rate limits
- **Authentication** — protect the API endpoints
- **Database** — persist reports for historical comparison and analytics
- **Webhook notifications** — notify when a research run completes instead of polling
- **Rate limit handling** — smarter backoff for GitHub's 60 req/hour unauthenticated limit
- **Tests** — unit tests for enrichment parsing, integration tests with mocked APIs
- **Additional LLM providers** — OpenAI, Anthropic support via the existing `src/lib/llm.ts` abstraction
