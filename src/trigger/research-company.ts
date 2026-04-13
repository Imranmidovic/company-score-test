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

    // Run enrichment tasks sequentially (Trigger.dev doesn't support Promise.all with triggerAndWait)
    const githubResult = await fetchGitHub.triggerAndWait({ orgName });
    const hnResult = await fetchHackerNews.triggerAndWait({ domain });

    // Extract enrichment data — map wait result to our types
    const github: EnrichmentResult<GitHubData> = githubResult.ok
      ? githubResult.output
      : { success: false, error: `Task failed: ${String(githubResult.error)}` };

    const hackerNews: EnrichmentResult<HackerNewsData> = hnResult.ok
      ? hnResult.output
      : { success: false, error: `Task failed: ${String(hnResult.error)}` };

    // Prepare LLM input — pass data if available, null if not
    const githubData: GitHubData | null = github.success ? github.data : null;
    const hnData: HackerNewsData | null = hackerNews.success
      ? hackerNews.data
      : null;

    // Run LLM analysis
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
