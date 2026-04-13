# Company Research Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a company research agent that enriches a domain with GitHub + Hacker News data, scores the lead with an LLM, and returns a structured report.

**Architecture:** Trigger.dev v3 orchestrator fans out enrichment subtasks in parallel, collects results, passes them to an LLM analysis subtask, and assembles a final report. Express provides two HTTP endpoints (trigger + status). All config is centralized and Zod-validated.

**Tech Stack:** Node.js, TypeScript (strict), Trigger.dev v3, Vercel AI SDK (`ai` + `@ai-sdk/google`), Express, Zod

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | Strict TypeScript config |
| `.gitignore` | Ignore node_modules, .env, dist |
| `.env` | API keys (not committed) |
| `src/config.ts` | Centralized Zod-validated config from env vars |
| `src/types.ts` | All shared types, Zod schemas, discriminated unions |
| `src/trigger/fetch-github.ts` | GitHub enrichment subtask |
| `src/trigger/fetch-hackernews.ts` | Hacker News enrichment subtask |
| `src/trigger/analyze-with-llm.ts` | LLM analysis subtask |
| `src/trigger/research-company.ts` | Orchestrator task |
| `src/server.ts` | Express app with POST + GET endpoints |
| `trigger.config.ts` | Minimal Trigger.dev config, imports from src/config |
| `README.md` | How to run, architecture, improvements |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "company-research-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "npx tsx src/server.ts",
    "dev:trigger": "npx trigger dev",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@ai-sdk/google": "^1.0.0",
    "@trigger.dev/sdk": "^4.0.0",
    "ai": "^4.0.0",
    "express": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "trigger.dev": "^4.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src/**/*.ts", "trigger.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.trigger/
```

- [ ] **Step 4: Create .env**

```env
TRIGGER_SECRET_KEY=your-trigger-secret-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules` created, `package-lock.json` generated, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "feat: scaffold project with dependencies and typescript config"
```

---

## Task 2: Centralized Config

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Create src/config.ts**

```typescript
import { z } from "zod";

const envSchema = z.object({
  TRIGGER_SECRET_KEY: z.string().min(1),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("gemini-2.0-flash"),
  PORT: z.coerce.number().default(3000),
  GITHUB_API_BASE_URL: z.string().url().default("https://api.github.com"),
  HN_API_BASE_URL: z
    .string()
    .url()
    .default("https://hn.algolia.com/api/v1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  trigger: {
    secretKey: env.TRIGGER_SECRET_KEY,
  },
  llm: {
    model: env.LLM_MODEL,
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
  server: {
    port: env.PORT,
  },
  apis: {
    github: {
      baseUrl: env.GITHUB_API_BASE_URL,
    },
    hackerNews: {
      baseUrl: env.HN_API_BASE_URL,
    },
  },
} as const;

export type Config = typeof config;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add centralized Zod-validated config"
```

---

## Task 3: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

```typescript
import { z } from "zod";

// --- Generic enrichment result ---

export type EnrichmentSuccess<T> = { success: true; data: T };
export type EnrichmentFailure = { success: false; error: string };
export type EnrichmentResult<T> = EnrichmentSuccess<T> | EnrichmentFailure;

// --- GitHub types ---

export const gitHubRepoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  language: z.string().nullable(),
});

export type GitHubRepo = z.infer<typeof gitHubRepoSchema>;

export const gitHubDataSchema = z.object({
  orgName: z.string(),
  description: z.string().nullable(),
  publicRepos: z.number(),
  topRepos: z.array(gitHubRepoSchema),
});

export type GitHubData = z.infer<typeof gitHubDataSchema>;

// --- Hacker News types ---

export const hnStorySchema = z.object({
  title: z.string(),
  points: z.number().nullable(),
  url: z.string().nullable(),
  created_at: z.string(),
});

export type HNStory = z.infer<typeof hnStorySchema>;

export const hackerNewsDataSchema = z.object({
  stories: z.array(hnStorySchema),
  totalHits: z.number(),
});

export type HackerNewsData = z.infer<typeof hackerNewsDataSchema>;

// --- LLM analysis types ---

export const llmAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  analysis: z.string(),
  recommendation: z.enum(["hot", "warm", "cold"]),
});

export type LLMAnalysis = z.infer<typeof llmAnalysisSchema>;

// --- Company report ---

export interface CompanyReport {
  domain: string;
  orgName: string;
  github: EnrichmentResult<GitHubData>;
  hackerNews: EnrichmentResult<HackerNewsData>;
  analysis: EnrichmentResult<LLMAnalysis>;
  completedAt: string;
}

// --- HTTP request/response schemas ---

export const researchRequestSchema = z.object({
  domain: z
    .string()
    .min(1)
    .refine((d) => d.includes("."), { message: "Domain must contain a dot" }),
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types, Zod schemas, and discriminated unions"
```

---

## Task 4: GitHub Enrichment Subtask

> **Parallelizable:** This task can be implemented simultaneously with Tasks 5 and 6 via subagents.

**Files:**
- Create: `src/trigger/fetch-github.ts`

- [ ] **Step 1: Create src/trigger/fetch-github.ts**

```typescript
import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type GitHubData,
  type GitHubRepo,
  gitHubRepoSchema,
} from "../types.js";

export const fetchGitHub = task({
  id: "fetch-github",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10_000,
  },
  run: async (payload: {
    orgName: string;
  }): Promise<EnrichmentResult<GitHubData>> => {
    const { orgName } = payload;
    const baseUrl = config.apis.github.baseUrl;

    try {
      // Fetch org info
      const orgResponse = await fetch(`${baseUrl}/orgs/${encodeURIComponent(orgName)}`);

      if (orgResponse.status === 403) {
        const remaining = orgResponse.headers.get("x-ratelimit-remaining");
        if (remaining === "0") {
          return {
            success: false,
            error: "GitHub API rate limit exceeded",
          };
        }
      }

      if (!orgResponse.ok) {
        return {
          success: false,
          error: `GitHub org fetch failed: ${orgResponse.status} ${orgResponse.statusText}`,
        };
      }

      const orgJson = (await orgResponse.json()) as {
        description: string | null;
        public_repos: number;
      };

      // Fetch top repos by stars
      const reposResponse = await fetch(
        `${baseUrl}/orgs/${encodeURIComponent(orgName)}/repos?sort=stars&direction=desc&per_page=10`
      );

      if (!reposResponse.ok) {
        return {
          success: false,
          error: `GitHub repos fetch failed: ${reposResponse.status} ${reposResponse.statusText}`,
        };
      }

      const reposJson = (await reposResponse.json()) as unknown[];

      const topRepos: GitHubRepo[] = reposJson
        .map((repo) => gitHubRepoSchema.safeParse(repo))
        .filter((result) => result.success)
        .map((result) => result.data);

      return {
        success: true,
        data: {
          orgName,
          description: orgJson.description,
          publicRepos: orgJson.public_repos,
          topRepos,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown GitHub fetch error";
      return { success: false, error: message };
    }
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/fetch-github.ts
git commit -m "feat: add GitHub enrichment subtask"
```

---

## Task 5: Hacker News Enrichment Subtask

> **Parallelizable:** This task can be implemented simultaneously with Tasks 4 and 6 via subagents.

**Files:**
- Create: `src/trigger/fetch-hackernews.ts`

- [ ] **Step 1: Create src/trigger/fetch-hackernews.ts**

```typescript
import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type HackerNewsData,
  type HNStory,
  hnStorySchema,
} from "../types.js";

export const fetchHackerNews = task({
  id: "fetch-hackernews",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10_000,
  },
  run: async (payload: {
    domain: string;
  }): Promise<EnrichmentResult<HackerNewsData>> => {
    const { domain } = payload;
    const baseUrl = config.apis.hackerNews.baseUrl;

    try {
      const url = `${baseUrl}/search?query=${encodeURIComponent(domain)}&tags=story&hitsPerPage=10`;
      const response = await fetch(url);

      if (!response.ok) {
        return {
          success: false,
          error: `HN API failed: ${response.status} ${response.statusText}`,
        };
      }

      const json = (await response.json()) as {
        hits: unknown[];
        nbHits: number;
      };

      const stories: HNStory[] = json.hits
        .map((hit) => hnStorySchema.safeParse(hit))
        .filter((result) => result.success)
        .map((result) => result.data)
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

      return {
        success: true,
        data: {
          stories,
          totalHits: json.nbHits,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown HN fetch error";
      return { success: false, error: message };
    }
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/fetch-hackernews.ts
git commit -m "feat: add Hacker News enrichment subtask"
```

---

## Task 6: LLM Analysis Subtask

> **Parallelizable:** This task can be implemented simultaneously with Tasks 4 and 5 via subagents.

**Files:**
- Create: `src/trigger/analyze-with-llm.ts`

- [ ] **Step 1: Create src/trigger/analyze-with-llm.ts**

```typescript
import { task } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type GitHubData,
  type HackerNewsData,
  type LLMAnalysis,
  llmAnalysisSchema,
} from "../types.js";

export const analyzeWithLLM = task({
  id: "analyze-with-llm",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: {
    domain: string;
    github: GitHubData | null;
    hackerNews: HackerNewsData | null;
  }): Promise<EnrichmentResult<LLMAnalysis>> => {
    const { domain, github, hackerNews } = payload;

    try {
      const google = createGoogleGenerativeAI({
        apiKey: config.llm.apiKey,
      });

      const model = google(config.llm.model);

      const prompt = buildPrompt(domain, github, hackerNews);

      const { output } = await generateText({
        model,
        output: Output.object({
          schema: llmAnalysisSchema,
        }),
        prompt,
      });

      if (!output) {
        return {
          success: false,
          error: "LLM returned no structured output",
        };
      }

      return { success: true, data: output };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown LLM error";
      return { success: false, error: message };
    }
  },
});

function buildPrompt(
  domain: string,
  github: GitHubData | null,
  hackerNews: HackerNewsData | null
): string {
  const parts: string[] = [
    `Analyze the following company: ${domain}`,
    "",
    "Based on the data below, produce:",
    "- A tech company score from 0 to 100 (higher = stronger tech presence)",
    "- A short analysis paragraph explaining the score",
    '- A lead recommendation: "hot" (score 70+), "warm" (40-69), or "cold" (below 40)',
    "",
  ];

  if (github) {
    parts.push("## GitHub Data");
    parts.push(`Organization: ${github.orgName}`);
    parts.push(`Description: ${github.description ?? "N/A"}`);
    parts.push(`Public repos: ${github.publicRepos}`);
    if (github.topRepos.length > 0) {
      parts.push("Top repositories:");
      for (const repo of github.topRepos) {
        parts.push(
          `  - ${repo.name}: ${repo.stargazers_count} stars, language: ${repo.language ?? "N/A"}`
        );
      }
    }
    parts.push("");
  } else {
    parts.push("## GitHub Data");
    parts.push("No GitHub data available (fetch failed).");
    parts.push("");
  }

  if (hackerNews) {
    parts.push("## Hacker News Mentions");
    parts.push(`Total mentions found: ${hackerNews.totalHits}`);
    if (hackerNews.stories.length > 0) {
      parts.push("Top stories:");
      for (const story of hackerNews.stories) {
        parts.push(`  - "${story.title}" (${story.points ?? 0} points)`);
      }
    }
    parts.push("");
  } else {
    parts.push("## Hacker News Mentions");
    parts.push("No Hacker News data available (fetch failed).");
    parts.push("");
  }

  return parts.join("\n");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/analyze-with-llm.ts
git commit -m "feat: add LLM analysis subtask with structured output"
```

---

## Task 7: Research Company Orchestrator

**Files:**
- Create: `src/trigger/research-company.ts`

- [ ] **Step 1: Create src/trigger/research-company.ts**

```typescript
import { task } from "@trigger.dev/sdk";
import { fetchGitHub } from "./fetch-github.js";
import { fetchHackerNews } from "./fetch-hackernews.js";
import { analyzeWithLLM } from "./analyze-with-llm.js";
import type {
  CompanyReport,
  GitHubData,
  HackerNewsData,
  EnrichmentResult,
} from "../types.js";

function extractOrgName(domain: string): string {
  return domain.split(".")[0]!;
}

export const researchCompany = task({
  id: "research-company",
  run: async (payload: { domain: string }): Promise<CompanyReport> => {
    const { domain } = payload;
    const orgName = extractOrgName(domain);

    // Fan out enrichment tasks in parallel
    const [githubResult, hnResult] = await Promise.all([
      fetchGitHub.triggerAndWait({ orgName }),
      fetchHackerNews.triggerAndWait({ domain }),
    ]);

    // Extract enrichment data — map triggerAndWait result to our types
    const github: EnrichmentResult<GitHubData> = githubResult.ok
      ? githubResult.output
      : { success: false, error: `Task failed: ${String(githubResult.error)}` };

    const hackerNews: EnrichmentResult<HackerNewsData> = hnResult.ok
      ? hnResult.output
      : { success: false, error: `Task failed: ${String(hnResult.error)}` };

    // Prepare LLM input — pass data if available, null if not
    const githubData: GitHubData | null =
      github.success ? github.data : null;
    const hnData: HackerNewsData | null =
      hackerNews.success ? hackerNews.data : null;

    // Run LLM analysis
    const llmResult = await analyzeWithLLM.triggerAndWait({
      domain,
      github: githubData,
      hackerNews: hnData,
    });

    const analysis = llmResult.ok
      ? llmResult.output
      : { success: false as const, error: `LLM task failed: ${String(llmResult.error)}` };

    return {
      domain,
      orgName,
      github,
      hackerNews,
      analysis,
      completedAt: new Date().toISOString(),
    };
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/research-company.ts
git commit -m "feat: add research company orchestrator task"
```

---

## Task 8: Express Server

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Create src/server.ts**

```typescript
import express, { type Request, type Response } from "express";
import { tasks, runs } from "@trigger.dev/sdk";
import { config } from "./config.js";
import { researchRequestSchema, type CompanyReport } from "./types.js";
import type { researchCompany } from "./trigger/research-company.js";

const app = express();
app.use(express.json());

// POST /api/research — trigger a new research run
app.post("/api/research", async (req: Request, res: Response) => {
  const parsed = researchRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const handle = await tasks.trigger<typeof researchCompany>(
      "research-company",
      { domain: parsed.data.domain }
    );

    res.status(202).json({
      runId: handle.id,
      status: "QUEUED",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to trigger task";
    res.status(500).json({ error: message });
  }
});

// GET /api/research/:runId — check status and retrieve results
app.get("/api/research/:runId", async (req: Request, res: Response) => {
  const { runId } = req.params;

  if (!runId) {
    res.status(400).json({ error: "Missing runId parameter" });
    return;
  }

  try {
    const run = await runs.retrieve<typeof researchCompany>(runId);

    if (run.status === "COMPLETED") {
      // Fetch the output from the presigned URL
      let report: CompanyReport | undefined;

      if (run.outputPresignedUrl) {
        const outputResponse = await fetch(run.outputPresignedUrl);
        report = (await outputResponse.json()) as CompanyReport;
      }

      res.json({
        runId: run.id,
        status: run.status,
        report,
      });
      return;
    }

    if (run.status === "FAILED" || run.status === "CANCELED") {
      res.json({
        runId: run.id,
        status: run.status,
        error: run.error,
      });
      return;
    }

    // Still running
    res.json({
      runId: run.id,
      status: run.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve run";
    res.status(500).json({ error: message });
  }
});

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add Express server with research endpoints"
```

---

## Task 9: Trigger.dev Config

**Files:**
- Create: `trigger.config.ts`

- [ ] **Step 1: Create trigger.config.ts**

```typescript
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "company-research-agent",
  dirs: ["src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
    },
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add trigger.config.ts
git commit -m "feat: add Trigger.dev config"
```

---

## Task 10: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions and architecture"
```

---

## Execution Notes

- **Tasks 4, 5, 6 are parallelizable** — dispatch as subagents simultaneously after Tasks 1-3 are done.
- **Tasks 7-10 are sequential** — each depends on prior files existing.
- All `npx tsc --noEmit` checks require Task 1 (npm install) to be complete first.
