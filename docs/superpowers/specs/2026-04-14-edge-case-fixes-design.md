# Edge Case Fixes: HN Relevance + GitHub Org Discovery

## Problem

1. **HN false positives:** Searching HN for `scribe.com` returns stories about `scribd.com`. The LLM analyzes these as if they belong to the target company.
2. **GitHub org mismatch:** `extractOrgName("meta.com")` returns `"meta"`, but Meta's GitHub org is `"facebook"`. Many companies don't have a GitHub org name matching their domain prefix.

## Solution

### HN Relevance Filtering

Add an instruction to the LLM prompt (in `buildPrompt()`) telling it to ignore HN stories that are about different companies. No changes to data fetching — the LLM already receives the stories and is capable of filtering by relevance.

Prompt addition in the Hacker News section:
> "Note: Some results may be about similarly-named but different companies. Only consider stories that are actually about {domain}. Ignore irrelevant results in your analysis."

### GitHub Org Discovery

Replace `extractOrgName(domain)` with a new `findGitHubOrg(domain)` function that uses the GitHub Search API:

1. Call `GET {baseUrl}/search/users?q={domain}+type:org`
2. If results are returned, use the first match's `login` field as the org name
3. If no results (empty `items` array), fall back to `domain.split(".")[0]`

**Impact on data flow:**
- `fetchGitHubData` changes signature from `(orgName: string)` to `(domain: string)` — it calls `findGitHubOrg(domain)` internally
- `researchCompany` orchestrator no longer calls `extractOrgName` — passes `domain` directly to `fetchGitHub` task
- `extractOrgName` is removed (no longer needed)

**New Zod schema for the search response:**
```typescript
const gitHubSearchUsersResponseSchema = z.object({
  total_count: z.number(),
  items: z.array(z.object({
    login: z.string(),
  })),
});
```

## Files Changed

| File | Change |
|------|--------|
| `src/service/trigger-service.ts` | Remove `extractOrgName`, add `findGitHubOrg`, update `fetchGitHubData` signature, update `buildPrompt`, update `researchCompany` task |
| `src/types.ts` | Add `gitHubSearchUsersResponseSchema` |
