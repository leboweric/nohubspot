# Toggl API Data Inventory - SCC Workspace

## Authentication
- **Method**: HTTP Basic Auth (email:password) or API Token
- **API Token**: 34145427... (available via /me endpoint)
- **User**: Kharding (ID: 5064990), admin role
- **Workspace ID**: 3639704

## Subscription Plan
- **Quota**: 240 requests/hour → **Starter plan**
- Rate limit: 1 req/sec leaky bucket

## Data Volumes

| Entity | Count | Notes |
|--------|-------|-------|
| Clients | 169 | Active + archived |
| Projects | 200+ | 48 active, 152 archived. 196 billable, 122 with rates, 164 with client |
| Tags | 17 | |
| Workspace Members | 17 | 3 admins, 14 users |
| Time Entries | Unknown total | Reports API returns 50/page, paginated |

## Key API Endpoints Available

### Track API v9 (base: https://api.track.toggl.com/api/v9)
- `GET /me` - User info + API token
- `GET /workspaces/{wid}/clients` - All clients (status=both for archived too)
- `GET /workspaces/{wid}/projects` - All projects (active=both, per_page=200 max)
- `GET /workspaces/{wid}/tags` - All tags
- `GET /workspaces/{wid}/workspace_users` - All members with roles
- `GET /workspaces/{wid}/project_users` - Project-member assignments WITH RATES
- `GET /me/time_entries` - User's own entries (max 90 days back)

### Reports API v3 (base: https://api.track.toggl.com/reports/api/v3)
- `POST /workspace/{wid}/search/time_entries` - ALL users' entries (paginated, 50/page)
  - Supports: date range (max 366 days), user_ids, project_ids, client_ids, tag_ids filters
  - Returns: user_id, username, email, project_id, project_name, client_name, description, billable, hourly_rate_in_cents, billable_amount_in_cents, time_entries array
  - Pagination: X-Next-ID, X-Next-Row-Number headers
  - enrich_response=true for full data

## Critical Findings

### Project Users endpoint has RATES!
`GET /workspaces/{wid}/project_users?project_ids=X` returns:
- user_id, project_id, rate (consultant rate!), manager flag
- This is exactly the dual-rate data we need

### Time Entries via Reports API
- The `/me/time_entries` endpoint only goes back 90 days
- The Reports API `/search/time_entries` goes back 366 days per request
- For older data, need to make multiple requests with different date ranges
- Page size max 50, need to paginate

### Rate Limits
- Starter plan: 240 requests/hour
- Need to be strategic about pagination
- 200 projects * 1 req each for project_users = 200 requests just for rates
- Better: single request with all project_ids comma-separated
