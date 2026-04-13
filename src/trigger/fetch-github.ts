import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import { fetchJson, HttpError } from "../http.js";
import {
  type EnrichmentResult,
  type GitHubData,
  type GitHubRepo,
  gitHubOrgResponseSchema,
  gitHubRepoSchema,
} from "../types.js";
import { z } from "zod";

export const fetchGitHub = task({
  id: "fetch-github",
  retry: config.retry.enrichment,
  run: async (payload: {
    orgName: string;
  }): Promise<EnrichmentResult<GitHubData>> => {
    const { orgName } = payload;
    const baseUrl = config.apis.github.baseUrl;
    const encodedOrg = encodeURIComponent(orgName);

    try {
      const org = await fetchJson(
        `${baseUrl}/orgs/${encodedOrg}`,
        gitHubOrgResponseSchema,
      );

      const repos = await fetchJson(
        `${baseUrl}/orgs/${encodedOrg}/repos?sort=stars&direction=desc&per_page=10`,
        z.array(z.unknown()),
      );

      const topRepos: GitHubRepo[] = repos
        .map((repo) => gitHubRepoSchema.safeParse(repo))
        .filter((result) => result.success)
        .map((result) => result.data);

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
  },
});
