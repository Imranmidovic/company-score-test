# Frontend UI — Design Spec

## Overview

Single-page frontend served statically by Express. One `public/index.html` with inline CSS/JS. No additional dependencies.

## UI Flow

1. User enters a domain in the input field, clicks "Research"
2. Frontend calls `POST /api/research` with the domain
3. On success, starts polling `GET /api/research/:runId` every 2 seconds
4. Shows loading spinner while polling
5. On `COMPLETED` — displays the full report
6. On `FAILED`/`CANCELED` — displays error message
7. Input is disabled during loading, re-enabled after result or error

## Report Display

- **Score** — large number (0-100), prominent
- **Recommendation badge** — colored: green for "hot", yellow for "warm", gray for "cold"
- **Analysis** — paragraph text
- **GitHub section** — org name, description, repo count, table of top repos (name, stars, language)
- **Hacker News section** — list of stories with title, points, date

If an enrichment source failed, show a note ("GitHub data unavailable") instead of that section.

## Styling

Clean, minimal CSS. Light background, no framework. Centered content with max-width for readability.

## Files

- Create: `public/index.html` — full HTML/CSS/JS inline
- Modify: `src/server.ts` — add `app.use(express.static("public"))` before route handlers

## Out of Scope

- No routing, no multiple pages
- No persistent history of past runs
- No framework or build step
