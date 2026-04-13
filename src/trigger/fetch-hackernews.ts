import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import { fetchJson } from "../http.js";
import {
  type EnrichmentResult,
  type HackerNewsData,
  type HNStory,
  hnSearchResponseSchema,
  hnStorySchema,
} from "../types.js";

export const fetchHackerNews = task({
  id: "fetch-hackernews",
  retry: config.retry.enrichment,
  run: async (payload: {
    domain: string;
  }): Promise<EnrichmentResult<HackerNewsData>> => {
    const { domain } = payload;
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
  },
});
