import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type HackerNewsData,
  type HNStory,
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
      const response = await fetch(url);

      if (!response.ok) {
        return {
          success: false,
          error: `HN API failed: ${response.status} ${response.statusText}`,
        };
      }

      const json = (await response.json()) as {
        hits: unknown[];
        nbHits: number;
      };

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
