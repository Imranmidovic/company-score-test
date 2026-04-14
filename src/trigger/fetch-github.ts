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
