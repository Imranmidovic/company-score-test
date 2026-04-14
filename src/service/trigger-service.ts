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
