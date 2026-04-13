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
