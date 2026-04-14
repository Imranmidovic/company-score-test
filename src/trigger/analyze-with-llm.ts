import { task } from "@trigger.dev/sdk";
import { config } from "../config.js";
import {
  type EnrichmentResult,
  type GitHubData,
  type HackerNewsData,
  type LLMAnalysis,
} from "../types.js";
import { analyzeCompanyWithLLM } from "../service/trigger-service.js";

export const analyzeWithLLM = task({
  id: "analyze-with-llm",
  retry: config.retry.llm,
  run: async (payload: {
    domain: string;
    github: GitHubData | null;
    hackerNews: HackerNewsData | null;
  }): Promise<EnrichmentResult<LLMAnalysis>> => {
    return analyzeCompanyWithLLM(payload);
  },
});
