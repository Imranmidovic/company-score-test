import { z } from "zod";

const envSchema = z.object({
  TRIGGER_SECRET_KEY: z.string().min(1),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("gemini-2.5-flash"),
  PORT: z.coerce.number().default(3000),
  GITHUB_API_BASE_URL: z.string().url().default("https://api.github.com"),
  HN_API_BASE_URL: z
    .string()
    .url()
    .default("https://hn.algolia.com/api/v1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  trigger: {
    secretKey: env.TRIGGER_SECRET_KEY,
  },
  llm: {
    model: env.LLM_MODEL,
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
  server: {
    port: env.PORT,
  },
  retry: {
    enrichment: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
    },
    llm: {
      maxAttempts: 3,
    },
  },
  apis: {
    github: {
      baseUrl: env.GITHUB_API_BASE_URL,
    },
    hackerNews: {
      baseUrl: env.HN_API_BASE_URL,
    },
  },
} as const;

export type Config = typeof config;
