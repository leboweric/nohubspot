# Toggl to NotHubSpot Migration Plan

## Executive Summary

The Toggl Track API (v9 + Reports API v3) provides full programmatic access to all of SCC's data. The workspace (ID: 3639704) contains 169 clients, 200+ projects, 17 tags, 17 members, and an unknown but substantial volume of time entries spanning several years. The migration is entirely feasible using Krista's admin credentials, which have access to all workspace data including other users' time entries via the Reports API.

## Data Mapping

| Toggl Entity | Toggl API Endpoint | NHS Target | Field Mapping |
|---|---|---|---|
| Clients (169) | `GET /workspaces/{wid}/clients` | `Company` table (existing) | name, archived status, notes |
| Projects (200+) | `GET /workspaces/{wid}/projects` | `Project` table (existing) | name, client_id, rate (client billing rate), billable, active, estimated_hours, color, start/end dates |
| Tags (17) | `GET /workspaces/{wid}/tags` | New `Tag` table or JSON field | name |
| Members (17) | `GET /workspaces/{wid}/workspace_users` | `User` table (existing) | name, email, role |
| Project-Member Rates | `GET /workspaces/{wid}/project_users` | `ProjectMemberRate` table (new) | project_id, user_id, consultant_rate, manager flag |
| Time Entries | `POST /reports/api/v3/workspace/{wid}/search/time_entries` | `TimeEntry` table (new) | user_id, project_id, description, start, stop, duration, billable, tags |

## Migration Strategy

The migration should proceed in dependency order to maintain referential integrity. Clients must come first since projects reference them, then projects, then members and project-member rates, and finally time entries which reference all of the above.

### Phase 1: Reference Data (fast, low volume)

This phase covers clients, projects, tags, and members. All of these can be fetched in a handful of API calls and imported in seconds.

**Clients** are fetched with a single `GET /workspaces/3639704/clients?status=both` call. Each client maps to a Company record in NHS. The Toggl client ID should be stored as `toggl_id` on the Company for cross-referencing.

**Projects** require one call with `active=both&per_page=200`. Each project maps to an NHS Project record. The Toggl `rate` field is the client billing rate (stored as `hourly_rate` on the NHS Project). The `client_id` links to the imported Company via the stored `toggl_id`. Estimated hours, color, and date fields map directly.

**Tags** are fetched with one call. These can be stored as a simple lookup table or as a JSON array on time entries.

**Members** come from `GET /workspaces/3639704/workspace_users`. These need to be matched to existing NHS users by email, or new user accounts created for consultants who don't yet have NHS logins.

### Phase 2: Rates (the critical dual-rate data)

The `GET /workspaces/{wid}/project_users` endpoint is the gold mine. It returns the consultant pay rate for each user on each project. This maps directly to the `ProjectMemberRate` table we just built. To minimize API calls, we can batch project IDs in a single request using the `project_ids` query parameter (comma-separated).

With 200 projects, this could require a few batched requests. Each response includes `user_id`, `project_id`, `rate` (consultant rate), and `manager` flag.

### Phase 3: Time Entries (bulk, requires pagination)

This is the largest data set and the most API-intensive. The Reports API `POST /workspace/{wid}/search/time_entries` endpoint returns all users' entries but is limited to 366-day windows and 50 entries per page.

**Estimation of volume**: If 13 active consultants average 5 entries/day over 3 years, that is roughly 71,000 entries. At 50 per page, that is 1,420 pages. At 240 requests/hour (Starter plan), fetching all entries would take approximately 6 hours of continuous API calls.

**Optimization strategies**:

1. **Year-by-year windows**: Break the full history into 365-day chunks to stay within the API's date range limit.
2. **Respect rate limits**: Monitor `X-Toggl-Quota-Remaining` headers and sleep when approaching limits. The leaky bucket allows 1 req/sec sustained.
3. **Enriched responses**: Use `enrich_response: true` to get full project names, client names, and usernames in a single call, avoiding follow-up lookups.
4. **Incremental sync**: After initial import, use the `since` parameter (UNIX timestamp) to fetch only entries modified after the last sync.

Each time entry from the Reports API includes: `user_id`, `username`, `email`, `project_id`, `project_name`, `client_name`, `description`, `billable`, `hourly_rate_in_cents`, `billable_amount_in_cents`, `tag_ids`, and a `time_entries` array with `id`, `start`, `stop`, `seconds`.

## Effort and Cost Assessment

| Item | Estimate | Notes |
|---|---|---|
| Build migration script | 2-3 hours | Python script with pagination, rate limiting, error handling |
| Reference data import | < 5 minutes runtime | ~10 API calls total |
| Rates import | < 5 minutes runtime | ~5 API calls total |
| Time entries import | 4-8 hours runtime | Depends on total volume, rate-limited |
| Testing and validation | 1-2 hours | Verify counts, spot-check entries |
| **Total build effort** | **3-5 hours** | |
| **Total runtime** | **5-9 hours** | Can run unattended overnight |

## Rate Limit Constraints

SCC is on the Toggl **Starter plan** (240 requests/hour per user per org). This is the primary bottleneck. The migration script must implement exponential backoff on 429 responses and respect the `X-Toggl-Quota-Remaining` header. At 1 request/second sustained (leaky bucket), the theoretical max is 3,600 requests/hour, but the Starter quota caps it at 240/hour for workspace-scoped requests.

**Option to accelerate**: If SCC temporarily upgrades to Premium (600 req/hr), the time entry import would complete in roughly 2-3 hours instead of 6-8.

## What We Need From the Client

1. **Confirmation to proceed** with the migration using Krista's credentials.
2. **Date range**: How far back do they need historical data? All time? Last 2 years? This significantly affects runtime.
3. **User mapping**: A list matching Toggl usernames to NHS user accounts (or permission to auto-create accounts).
4. **Toggl plan info**: Confirm Starter plan, or willingness to temporarily upgrade for faster migration.

## Post-Migration Sync

After the initial bulk import, the migration script can be scheduled to run daily using the `since` parameter to pull only new/modified entries. This provides a transition period where consultants can continue using Toggl while the NHS time tracking module is being tested, with all data flowing into NHS automatically.
