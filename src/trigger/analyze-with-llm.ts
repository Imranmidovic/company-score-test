import { task } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";
import { getModel } from "../llm.js";
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
