import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "../config.js";

export function getModel(): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: config.llm.apiKey,
  });

  return google(config.llm.model);
}
