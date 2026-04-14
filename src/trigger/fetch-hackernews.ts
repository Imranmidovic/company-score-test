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
