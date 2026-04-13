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

Copy `.env` and fill in your keys:

```env
TRIGGER_SECRET_KEY=your-trigger-secret-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
LLM_MODEL=gemini-2.0-flash          # optional
PORT=3000                             # optional
GITHUB_API_BASE_URL=https://api.github.com    # optional
HN_API_BASE_URL=https://hn.algolia.com/api/v1 # optional
```

### Running

Start the Trigger.dev dev server and the Express server in separate terminals:

```bash
# Terminal 1: Trigger.dev
npx trigger dev

# Terminal 2: Express server
npm run dev
```

### Usage

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
