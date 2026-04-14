import { z } from "zod";

// --- Generic enrichment result ---

export type EnrichmentSuccess<T> = { success: true; data: T };
export type EnrichmentFailure = { success: false; error: string };
export type EnrichmentResult<T> = EnrichmentSuccess<T> | EnrichmentFailure;

// --- GitHub API response schemas ---

export const gitHubOrgResponseSchema = z.object({
  description: z.string().nullable(),
  public_repos: z.number(),
});

export type GitHubOrgResponse = z.infer<typeof gitHubOrgResponseSchema>;

export const gitHubRepoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  language: z.string().nullable(),
});

export type GitHubRepo = z.infer<typeof gitHubRepoSchema>;

export const gitHubReposResponseSchema = z.array(gitHubRepoSchema.passthrough());

export const gitHubSearchUsersResponseSchema = z.object({
  total_count: z.number(),
  items: z.array(z.object({
    login: z.string(),
  })),
});

export type GitHubSearchUsersResponse = z.infer<typeof gitHubSearchUsersResponseSchema>;

export const gitHubDataSchema = z.object({
  orgName: z.string(),
  description: z.string().nullable(),
  publicRepos: z.number(),
  topRepos: z.array(gitHubRepoSchema),
});

export type GitHubData = z.infer<typeof gitHubDataSchema>;

// --- Hacker News API response schema ---

export const hnSearchResponseSchema = z.object({
  hits: z.array(z.unknown()),
  nbHits: z.number(),
});

export type HNSearchResponse = z.infer<typeof hnSearchResponseSchema>;

export const hnStorySchema = z.object({
  title: z.string(),
  points: z.number().nullable(),
  url: z.string().nullable(),
  created_at: z.string(),
});

export type HNStory = z.infer<typeof hnStorySchema>;

export const hackerNewsDataSchema = z.object({
  stories: z.array(hnStorySchema),
  totalHits: z.number(),
});

export type HackerNewsData = z.infer<typeof hackerNewsDataSchema>;

// --- LLM analysis types ---

export const llmAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  analysis: z.string(),
  recommendation: z.enum(["hot", "warm", "cold"]),
});

export type LLMAnalysis = z.infer<typeof llmAnalysisSchema>;

// --- Company report ---

export interface CompanyReport {
  domain: string;
  orgName: string;
  github: EnrichmentResult<GitHubData>;
  hackerNews: EnrichmentResult<HackerNewsData>;
  analysis: EnrichmentResult<LLMAnalysis>;
  completedAt: string;
}

// --- HTTP request/response schemas ---

export const researchRequestSchema = z.object({
  domain: z
    .string()
    .min(1)
    .refine((d) => d.includes("."), { message: "Domain must contain a dot" }),
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
