# Layered Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor flat `src/` structure into layered architecture with router, controllers, service, lib, and util directories.

**Architecture:** Express server mounts a single router that delegates to controller handlers. Controllers call Trigger.dev SDK. Trigger tasks are thin wrappers that delegate to `service/trigger-service.ts` which holds all business logic. `util/` holds generic helpers (`http.ts`), `lib/` holds SDK-specific wrappers (`llm.ts`).

**Tech Stack:** Node.js, TypeScript (strict), Trigger.dev v3, Vercel AI SDK, Express, Zod

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Keep | `src/config.ts` | Centralized Zod-validated config |
| Keep | `src/types.ts` | All shared types and Zod schemas |
| Create | `src/util/http.ts` | Generic `fetchJson` wrapper + `HttpError` |
| Create | `src/lib/llm.ts` | AI SDK `getModel()` factory |
| Create | `src/service/trigger-service.ts` | All business logic extracted from trigger tasks |
| Create | `src/router.ts` | All Express route definitions |
| Create | `src/controllers/research.ts` | Handler functions for research endpoints |
| Modify | `src/server.ts` | Slim to app setup + mount router + listen |
| Modify | `src/trigger/fetch-github.ts` | Thin wrapper calling service |
| Modify | `src/trigger/fetch-hackernews.ts` | Thin wrapper calling service |
| Modify | `src/trigger/analyze-with-llm.ts` | Thin wrapper calling service |
| Modify | `src/trigger/research-company.ts` | Import `extractOrgName` from service |
| Delete | `src/http.ts` | Replaced by `src/util/http.ts` |
| Delete | `src/llm.ts` | Replaced by `src/lib/llm.ts` |
| Modify | `CLAUDE.md` | Update file structure section |

---

### Task 1: Move http.ts to util/http.ts

**Files:**
- Create: `src/util/http.ts`
- Delete: `src/http.ts`
- Modify: `src/trigger/fetch-github.ts` (import path)
- Modify: `src/trigger/fetch-hackernews.ts` (import path)

- [ ] **Step 1: Create `src/util/http.ts` with same content as `src/http.ts`**

```typescript
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly headers: Headers,
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
  }

  get isRateLimited(): boolean {
    return (
      this.status === 403 &&
      this.headers.get("x-ratelimit-remaining") === "0"
    );
  }
}

export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, response.headers);
  }

  const json: unknown = await response.json();
  return schema.parse(json);
}
```

- [ ] **Step 2: Update import in `src/trigger/fetch-github.ts`**

Change line 3 from:
```typescript
import { fetchJson, HttpError } from "../http.js";
```
to:
```typescript
import { fetchJson, HttpError } from "../util/http.js";
```

- [ ] **Step 3: Update import in `src/trigger/fetch-hackernews.ts`**

Change line 3 from:
```typescript
import { fetchJson } from "../http.js";
```
to:
```typescript
import { fetchJson } from "../util/http.js";
```

- [ ] **Step 4: Delete `src/http.ts`**

```bash
rm src/http.ts
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/util/http.ts src/trigger/fetch-github.ts src/trigger/fetch-hackernews.ts
git rm src/http.ts
git commit -m "refactor: move http.ts to util/http.ts"
```

---

### Task 2: Move llm.ts to lib/llm.ts

**Files:**
- Create: `src/lib/llm.ts`
- Delete: `src/llm.ts`
- Modify: `src/trigger/analyze-with-llm.ts` (import path)

- [ ] **Step 1: Create `src/lib/llm.ts` with same content as `src/llm.ts`**

```typescript
import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "../config.js";

export function getModel(): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: config.llm.apiKey,
  });

  return google(config.llm.model);
}
```

- [ ] **Step 2: Update import in `src/trigger/analyze-with-llm.ts`**

Change line 4 from:
```typescript
import { getModel } from "../llm.js";
```
to:
```typescript
import { getModel } from "../lib/llm.js";
```

- [ ] **Step 3: Delete `src/llm.ts`**

```bash
rm src/llm.ts
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm.ts src/trigger/analyze-with-llm.ts
git rm src/llm.ts
git commit -m "refactor: move llm.ts to lib/llm.ts"
```

---

### Task 3: Create service/trigger-service.ts

Extract all business logic from the three enrichment trigger tasks and the orchestrator's `extractOrgName` helper into the service layer.

**Files:**
- Create: `src/service/trigger-service.ts`

- [ ] **Step 1: Create `src/service/trigger-service.ts`**

```typescript
import { generateText, Output } from "ai";
import { getModel } from "../lib/llm.js";
import { fetchJson, HttpError } from "../util/http.js";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type GitHubData,
  type HackerNewsData,
  type HNStory,
  type LLMAnalysis,
  gitHubOrgResponseSchema,
  gitHubReposResponseSchema,
  hnSearchResponseSchema,
  hnStorySchema,
  llmAnalysisSchema,
} from "../types.js";

export function extractOrgName(domain: string): string {
  return domain.split(".")[0]!;
}

export async function fetchGitHubData(
  orgName: string,
): Promise<EnrichmentResult<GitHubData>> {
  const baseUrl = config.apis.github.baseUrl;
  const encodedOrg = encodeURIComponent(orgName);

  try {
    const org = await fetchJson(
      `${baseUrl}/orgs/${encodedOrg}`,
      gitHubOrgResponseSchema,
    );

    const topRepos = await fetchJson(
      `${baseUrl}/orgs/${encodedOrg}/repos?sort=stars&direction=desc&per_page=10`,
      gitHubReposResponseSchema,
    );

    return {
      success: true,
      data: {
        orgName,
        description: org.description,
        publicRepos: org.public_repos,
        topRepos,
      },
    };
  } catch (error) {
    if (error instanceof HttpError && error.isRateLimited) {
      return { success: false, error: "GitHub API rate limit exceeded" };
    }

    const message =
      error instanceof Error ? error.message : "Unknown GitHub fetch error";
    return { success: false, error: message };
  }
}

export async function fetchHackerNewsData(
  domain: string,
): Promise<EnrichmentResult<HackerNewsData>> {
  const baseUrl = config.apis.hackerNews.baseUrl;

  try {
    const url = `${baseUrl}/search?query=${encodeURIComponent(domain)}&tags=story&hitsPerPage=10`;
    const json = await fetchJson(url, hnSearchResponseSchema);

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
}

export async function analyzeCompanyWithLLM(payload: {
  domain: string;
  github: GitHubData | null;
  hackerNews: HackerNewsData | null;
}): Promise<EnrichmentResult<LLMAnalysis>> {
  const { domain, github, hackerNews } = payload;

  try {
    const model = getModel();
    const prompt = buildPrompt(domain, github, hackerNews);

    const { experimental_output: output } = await generateText({
      model,
      experimental_output: Output.object({
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
}

function buildPrompt(
  domain: string,
  github: GitHubData | null,
  hackerNews: HackerNewsData | null,
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
          `  - ${repo.name}: ${repo.stargazers_count} stars, language: ${repo.language ?? "N/A"}`,
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
Expected: No errors (trigger tasks still have their own logic, service is additive at this point).

- [ ] **Step 3: Commit**

```bash
git add src/service/trigger-service.ts
git commit -m "refactor: create trigger-service with extracted business logic"
```

---

### Task 4: Refactor trigger tasks to thin wrappers

Replace the business logic in each trigger task with a single call to the corresponding service function.

**Files:**
- Modify: `src/trigger/fetch-github.ts`
- Modify: `src/trigger/fetch-hackernews.ts`
- Modify: `src/trigger/analyze-with-llm.ts`
- Modify: `src/trigger/research-company.ts`

- [ ] **Step 1: Rewrite `src/trigger/fetch-github.ts`**

Replace entire file content with:

```typescript
import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import { type EnrichmentResult, type GitHubData } from "../types.js";
import { fetchGitHubData } from "../service/trigger-service.js";

export const fetchGitHub = task({
  id: "fetch-github",
  retry: config.retry.enrichment,
  run: async (payload: {
    orgName: string;
  }): Promise<EnrichmentResult<GitHubData>> => {
    return fetchGitHubData(payload.orgName);
  },
});
```

- [ ] **Step 2: Rewrite `src/trigger/fetch-hackernews.ts`**

Replace entire file content with:

```typescript
import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import { type EnrichmentResult, type HackerNewsData } from "../types.js";
import { fetchHackerNewsData } from "../service/trigger-service.js";

export const fetchHackerNews = task({
  id: "fetch-hackernews",
  retry: config.retry.enrichment,
  run: async (payload: {
    domain: string;
  }): Promise<EnrichmentResult<HackerNewsData>> => {
    return fetchHackerNewsData(payload.domain);
  },
});
```

- [ ] **Step 3: Rewrite `src/trigger/analyze-with-llm.ts`**

Replace entire file content with:

```typescript
import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type GitHubData,
  type HackerNewsData,
  type LLMAnalysis,
} from "../types.js";
import { analyzeCompanyWithLLM } from "../service/trigger-service.js";

export const analyzeWithLLM = task({
  id: "analyze-with-llm",
  retry: config.retry.llm,
  run: async (payload: {
    domain: string;
    github: GitHubData | null;
    hackerNews: HackerNewsData | null;
  }): Promise<EnrichmentResult<LLMAnalysis>> => {
    return analyzeCompanyWithLLM(payload);
  },
});
```

- [ ] **Step 4: Update `src/trigger/research-company.ts` to use `extractOrgName` from service**

Replace line 12-14 (`function extractOrgName...`) and add the import. Full file:

```typescript
import { task } from "@trigger.dev/sdk";
import { fetchGitHub } from "./fetch-github.js";
import { fetchHackerNews } from "./fetch-hackernews.js";
import { analyzeWithLLM } from "./analyze-with-llm.js";
import { extractOrgName } from "../service/trigger-service.js";
import type {
  CompanyReport,
  GitHubData,
  HackerNewsData,
  EnrichmentResult,
} from "../types.js";

export const researchCompany = task({
  id: "research-company",
  run: async (payload: { domain: string }): Promise<CompanyReport> => {
    const { domain } = payload;
    const orgName = extractOrgName(domain);

    const githubResult = await fetchGitHub.triggerAndWait({ orgName });
    const hnResult = await fetchHackerNews.triggerAndWait({ domain });

    const github: EnrichmentResult<GitHubData> = githubResult.ok
      ? githubResult.output
      : { success: false, error: `Task failed: ${String(githubResult.error)}` };

    const hackerNews: EnrichmentResult<HackerNewsData> = hnResult.ok
      ? hnResult.output
      : { success: false, error: `Task failed: ${String(hnResult.error)}` };

    const githubData: GitHubData | null = github.success ? github.data : null;
    const hnData: HackerNewsData | null = hackerNews.success
      ? hackerNews.data
      : null;

    const llmResult = await analyzeWithLLM.triggerAndWait({
      domain,
      github: githubData,
      hackerNews: hnData,
    });

    const analysis = llmResult.ok
      ? llmResult.output
      : {
          success: false as const,
          error: `LLM task failed: ${String(llmResult.error)}`,
        };

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

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/trigger/fetch-github.ts src/trigger/fetch-hackernews.ts src/trigger/analyze-with-llm.ts src/trigger/research-company.ts
git commit -m "refactor: trigger tasks delegate to service layer"
```

---

### Task 5: Create controllers/research.ts

Extract the handler logic from `server.ts` into controller functions.

**Files:**
- Create: `src/controllers/research.ts`

- [ ] **Step 1: Create `src/controllers/research.ts`**

```typescript
import { type Request, type Response } from "express";
import { tasks, runs } from "@trigger.dev/sdk";
import { researchRequestSchema, type CompanyReport } from "../types.js";
import type { researchCompany } from "../trigger/research-company.js";

export async function triggerResearch(
  req: Request,
  res: Response,
): Promise<void> {
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
      { domain: parsed.data.domain },
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
}

export async function getResearchStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const runId = req.params["runId"];

  if (!runId || typeof runId !== "string") {
    res.status(400).json({ error: "Missing runId parameter" });
    return;
  }

  try {
    const run = await runs.retrieve<typeof researchCompany>(runId);

    if (run.status === "COMPLETED") {
      res.json({
        runId: run.id,
        status: run.status,
        report: run.output as CompanyReport,
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

    res.json({
      runId: run.id,
      status: run.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve run";
    res.status(500).json({ error: message });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors (server.ts still has its own handlers — controller is additive).

- [ ] **Step 3: Commit**

```bash
git add src/controllers/research.ts
git commit -m "refactor: create research controller with handler functions"
```

---

### Task 6: Create router.ts

Single router file that maps all endpoints to controller handlers.

**Files:**
- Create: `src/router.ts`

- [ ] **Step 1: Create `src/router.ts`**

```typescript
import { Router } from "express";
import {
  triggerResearch,
  getResearchStatus,
} from "./controllers/research.js";

const router = Router();

router.post("/api/research", triggerResearch);
router.get("/api/research/:runId", getResearchStatus);

export { router };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/router.ts
git commit -m "refactor: create centralized router"
```

---

### Task 7: Slim down server.ts

Replace all route definitions in `server.ts` with router mount. Remove all imports that moved to controller/router.

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Rewrite `src/server.ts`**

Replace entire file content with:

```typescript
import express from "express";
import { config } from "./config.js";
import { router } from "./router.js";

const app = express();
app.use(express.static("public"));
app.use(express.json());
app.use(router);

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
git commit -m "refactor: slim server.ts to app setup and router mount"
```

---

### Task 8: Update CLAUDE.md file structure

Update the file structure section in CLAUDE.md to reflect the new layered architecture.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the `## File Structure` section in `CLAUDE.md`**

Replace the existing file structure block with:

````markdown
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
trigger.config.ts              — Trigger.dev config
```
````

- [ ] **Step 2: Verify no type errors remain**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md file structure for layered architecture"
```
