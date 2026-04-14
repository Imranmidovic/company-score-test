import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import { fetchJson, HttpError } from "../util/http.js";
import {
  type EnrichmentResult,
  type GitHubData,
  gitHubOrgResponseSchema,
  gitHubReposResponseSchema,
} from "../types.js";
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
  },
});
