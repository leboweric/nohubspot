# NotHubSpot Time Tracking Module: Toggl Replacement Requirements

## Executive Summary

Strategic Consulting & Coaching (SCC) currently uses Toggl Track to manage time tracking for their consulting team of 12-13 consultants. They want to eliminate Toggl entirely and replicate its functionality inside NotHubSpot (NHS), while also preparing for QuickBooks integration for invoicing. This document captures the complete Toggl workflow, data model, and requirements for the NHS replacement.

---

## 1. Current Toggl Setup

### 1.1 Workspace Structure

SCC operates a single Toggl workspace ("Kharding's workspace") on what appears to be a Starter or Premium plan. The workspace owner is Krista Harding (kharding@strategic-cc.com), who serves as the primary administrator.

### 1.2 Team Members (12 active + 1 admin)

| Username | Full Name (inferred) | Role | Consultant Rates |
|----------|---------------------|------|-----------------|
| Kharding | Krista Harding | Admin/Owner | $45, $85/hr |
| Akishbailey | Aisha Bailey | Consultant | $45, $50, $71, $85/hr |
| Cecily Harris | Cecily Harris | Consultant | $45, $71, $79/hr |
| Cjensen | C. Jensen | Consultant | $76.68, $85/hr |
| Ctaykalo | C. Taykalo | Consultant | $45, $50, $71, $85/hr |
| Dbartholomay | D. Bartholomay | Consultant | $45, $85/hr |
| Dmarty | D. Marty | Consultant | $45, $85/hr |
| Ellen Gibson Freelance | Ellen Gibson | Freelance | $50, $71/hr |
| Idavis | Imogen Davis | Consultant | $45, $50, $71, $85/hr |
| Jhipple | Jennifer Hipple | Consultant | $60, $85/hr |
| Molly Schwartz | Molly Schwartz | Consultant | $45, $85/hr |
| Roanderson | Renae Oswald Anderson | Consultant | $85/hr |
| Smarschalk | Susan Marschalk | Consultant | $45, $85/hr |

**Key insight**: Consultant pay rates vary by project type, not just by person. The same consultant may bill SCC at different rates depending on the type of work (e.g., grant writing at $45-50/hr vs. strategic consulting at $85/hr).

### 1.3 Clients (30+ active)

Clients are organizations that SCC provides consulting services to. Examples include:

- Amery Area Community Center
- Banyan Community
- Baywood Home Care
- Bush Foundation
- Clare Housing
- CornerHouse
- Crescent Cove
- Family Promise
- Family Wise
- FiftyNorth
- Freedom Park Center
- Girl Scouts River Valleys
- Great Northern Railway Historical Society
- MELSA
- MN Parks and Rec Foundation
- MN State Community and Technical College
- New Richmond Area Centre
- Northeast Youth and Family Services
- paleBLUEdot
- Parent Company
- Peace House Community
- Repowered
- River Valley Charities
- Sanneh Foundation
- Shoreview Community Foundation
- Solid Ground
- Southern Anoka Community Assistance
- Strategic Consulting & Coaching (internal)
- Touchstone Mental Health
- US Math Recovery Council
- Washburn Center for Children
- And more...

### 1.4 Projects (70+ active, across 3 pages)

Projects follow a specific naming convention that embeds the client billing rate:

**Format**: `[Service Type] - $[Rate]/hr`

**Examples**:
- "Board Bylaw Review - $150/hr"
- "Foundation Grant Writing - $75/hr"
- "Executive Coaching - $150/hr"
- "Development Consulting - $125/hr"
- "Corporate/Foundation Grant Writing - $75/hr"
- "Interim Leadership - $125/hr"
- "Prospect Research - $125/hr"
- "Luncheon Support - Flat Fee" (some are flat fee, not hourly)

**Project Configuration Fields**:
- Project name (with embedded client rate)
- Client (linked to a client entity)
- Color (for visual identification)
- Privacy (private to project members vs. public)
- Timeframe (start date, optional end date)
- Recurring toggle
- Time Estimate toggle (with hour budget)
- Billable toggle (with rate configuration)
- Tasks (sub-categorization within a project)
- Team members (with per-member roles and rates)

### 1.5 Client Billing Rates (embedded in project names)

| Rate | Service Types |
|------|--------------|
| $75/hr | Foundation Grants, Grant Writing, Research and Grants, Corporate/Foundation Grant Writing |
| $125/hr | Development Consulting, Client Meetings, Prospect Research, Executive Search, Interim Leadership, Government Grant Writing |
| $135/hr | (some projects) |
| $140/hr | (some projects) |
| $150/hr | Board Development, Board Training, Executive Coaching, Strategic Planning, Facilitation, Evaluation Services, Brand Strategy, Board Retreat Facilitation |
| Flat Fee | Luncheon Support, specific fixed-price projects |

### 1.6 Tags

Tags are used sparingly, mostly for specific grant or organization references:
- Alliance Housing Inc., Dakota Child and Family Clinic, DHS MN, Dreyfus Foundation, Hudson & Christian Community Homes, Jordan Family Grant, Listen Up! Youth Radio, project Pathfinder, Propel MN, SPCC, SPPC-GREAT RIVER, Start Early Funders Coalition, Stategic Plann, Stepping Stone, Target, Union Pacific, Volunteer Iowa

---

## 2. The Two-Rate System (Critical Business Logic)

This is the most important aspect of SCC's workflow. Toggl only supports one billing rate per time entry, so SCC runs **two separate monthly reports**:

### 2.1 Consultant Billing Report
- **Purpose**: Calculate what each consultant bills SCC
- **Rate used**: The consultant's pay rate (set per-member per-project in Toggl)
- **Grouped by**: Member, then individual time entries
- **Output**: Total hours and total amount per consultant per month

### 2.2 Client Invoicing Report
- **Purpose**: Calculate what SCC bills each client
- **Rate used**: The client rate (embedded in the project name, e.g., $150/hr)
- **Grouped by**: Project (which maps to client + service type)
- **Output**: Individual time entries with descriptions, used to create invoices

### 2.3 Rate Examples

For the same time entry (e.g., Renae working on "Board Bylaw Review - $150/hr"):
- **Client sees**: 1.75 hours x $150/hr = $262.50 (on the invoice)
- **Consultant bills SCC**: 1.75 hours x $85/hr = $148.75 (consultant payment)
- **SCC margin**: $262.50 - $148.75 = $113.75

**The NHS replacement MUST support both rates per time entry** — this is the primary pain point with Toggl.

---

## 3. Invoice Generation Workflow

### 3.1 Current Manual Process

1. End of month: Krista pulls the Client Invoicing report from Toggl (grouped by project)
2. For each project, she sees: consultant name, description of work, hours, dates
3. She manually aggregates time entries **by consultant and by week** (e.g., "Week of March 1:")
4. She concatenates descriptions for the same consultant in the same week
5. She deduplicates repeated descriptions (e.g., "email correspondence" appearing multiple times in a week)
6. She enters this into QuickBooks to generate the invoice
7. The invoice shows: Date | Activity (Consultant Name) | Description (Week of X: details) | QTY (hours) | Rate | Amount

### 3.2 Invoice Format (from PDF analysis - Invoice #2760)

**Header**: Strategic Consulting & Coaching, LLC with address and contact info
**Bill To**: Client name and address
**Invoice #**: Sequential numbering (e.g., 2760)
**Terms**: Due on receipt

**Line Items**:

| ACTIVITY | DESCRIPTION | QTY | RATE | AMOUNT |
|----------|-------------|-----|------|--------|
| Imogen Davis | Week of March 1: Revised and published AACC renter survey, correspondence with client | 1 | 150.00 | 150.00 |
| Jennifer Hipple | Week of March 16: Prepared for focus group, co-facilitated discussion with Renae, took notes, compiled document for report | 2.50 | 150.00 | 375.00 |
| Krista Harding | Week of March 30: Survey management | 0.25 | 150.00 | 37.50 |
| Renae Oswald Anderson | Week of March 1: Co-facilitated listening session with Amery City Council, phone interview with HRA ED, prepared notes from sessions | 1.75 | 150.00 | 262.50 |
| Renae Oswald Anderson | Week of March 9: Prepared meeting notes | 1 | 150.00 | 150.00 |
| Renae Oswald Anderson | Week of March 16: Co-facilitated board focus group | 1 | 150.00 | 150.00 |
| Renae Oswald Anderson | Week of March 23: Created Community Club survey | 0.75 | 150.00 | 112.50 |
| Susan Marschalk | Week of March 1: Meeting with Amery City Council | 1 | 150.00 | 150.00 |

### 3.3 Invoicing Complexity

- **15-30 invoices per month** (101 invoices in first 4 months of 2026)
- Some clients want **separate invoices per project** (e.g., when different funding sources pay for different projects)
- Some clients want **all projects on one invoice**
- This is client-specific and needs a configurable rule per client/project
- Descriptions need review before sending (abbreviations, deduplication)
- Invoices must be approved by Krista before sending

---

## 4. Access Control Requirements

### 4.1 Role-Based Visibility

| Role | Can See | Can Do |
|------|---------|--------|
| **Admin (Krista)** | All consultants' time entries, all projects, all rates, all reports | Everything |
| **Project Manager** | All time entries for projects they manage | View team hours, track budget |
| **Consultant** | Only their own time entries | Start/stop timer, add entries, edit own entries |

### 4.2 Privacy Requirements (from transcript)

> "They can't see each other's work. They can't see each other's time. How much each person is making is private."

- Consultants MUST NOT see other consultants' time entries or rates
- Project managers can see all entries for their managed projects only
- Admin sees everything across all projects and consultants
- Consultant pay rates are strictly private

---

## 5. Feature Requirements for NHS Time Tracking Module

### 5.1 Time Entry (Timer Page)

**Must replicate Toggl's timer interface:**
- Start/stop timer with running clock
- Manual time entry (start time, end time, or duration)
- Project selector (searchable dropdown)
- Description field (free text)
- Billable toggle
- Tag selector (optional)
- Edit existing entries
- Delete entries
- View entries by day with daily totals

### 5.2 Projects

**Extend existing NHS project model to include:**
- Client association (already exists in NHS)
- Client billing rate (per project) — currently embedded in project name in Toggl
- Consultant pay rate (per project-member) — the rate each consultant bills SCC for this project
- Time estimate/budget (hours)
- Actual hours tracked (auto-calculated from time entries)
- Budget tracking (hours used vs. estimated, with alerts)
- Project manager designation (can see all team entries)
- Team member assignment (already exists in NHS)
- Active/archived status

### 5.3 Reports

**Three report types needed:**

1. **Client Invoicing Report**
   - Grouped by project, then by consultant, then by week
   - Shows: consultant name, week, concatenated descriptions, total hours, client rate, amount
   - Filterable by date range, client, project
   - Exportable to CSV/Excel

2. **Consultant Billing Report**
   - Grouped by consultant
   - Shows: description, consultant rate, duration, amount
   - Filterable by date range, consultant
   - Exportable to CSV/Excel

3. **Summary Report**
   - Total hours, billable hours, total amounts
   - Charts: duration by day, distribution by member
   - Filterable by all dimensions

### 5.4 Invoice Preparation

**The key value-add over Toggl:**
- Auto-aggregate time entries by consultant + week for a given project
- Auto-concatenate descriptions within the same consultant+week
- Deduplicate repeated description phrases
- Generate invoice-ready line items in the format: Consultant | Week of X: descriptions | Hours | Rate | Amount
- Allow manual editing/review before finalizing
- Support client-specific invoicing rules (separate vs. combined invoices)
- Export to QuickBooks-compatible format OR direct QuickBooks API integration

### 5.5 QuickBooks Integration (Phase 2)

**From the transcript, the initial goal is:**
- Generate a report/spreadsheet that is "plug and play" for QuickBooks
- Krista must approve before anything is sent
- Future: auto-populate invoices in QuickBooks (but not auto-send)
- The invoice format must match their current QuickBooks invoice structure

### 5.6 Data Migration from Toggl

**Requirements:**
- Import all historical time entries via Toggl API
- Preserve: project, client, consultant, description, hours, dates, rates
- Critical for projects in progress that have budget tracking
- Toggl API endpoints available: Time Entries API, Reports API (CSV/Excel export)
- Workspace ID: 3639704

---

## 6. Data Model (New Tables/Extensions Needed)

### 6.1 New: TimeEntry

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| org_id | UUID | Organization |
| user_id | UUID | The consultant who logged time |
| project_id | UUID | Link to NHS Project |
| description | Text | What was done |
| start_time | DateTime | When work started |
| end_time | DateTime | When work ended |
| duration_seconds | Integer | Duration in seconds |
| is_billable | Boolean | Whether this entry is billable |
| tags | JSON | Optional tags |
| created_at | DateTime | When entry was created |
| updated_at | DateTime | Last modification |

### 6.2 New: ProjectMemberRate

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Link to Project |
| user_id | UUID | The consultant |
| consultant_rate | Decimal | What the consultant bills SCC (e.g., $85/hr) |
| effective_date | Date | When this rate took effect |

### 6.3 Extension: Project (add fields)

| Field | Type | Description |
|-------|------|-------------|
| client_billing_rate | Decimal | What the client pays per hour (e.g., $150/hr) |
| is_flat_fee | Boolean | Whether this is a flat-fee project |
| flat_fee_amount | Decimal | Total flat fee amount |
| time_budget_hours | Decimal | Estimated/budgeted hours |
| invoicing_rule | Enum | "separate" or "combined" (per client preference) |

### 6.4 New: InvoiceRule (per client)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| org_id | UUID | Organization |
| company_id | UUID | The client company |
| rule_type | Enum | "all_projects_one_invoice", "separate_per_project", "custom" |
| notes | Text | Special instructions |

---

## 7. Toggl API Integration (for Data Migration)

### 7.1 Available Endpoints

- **Workspace**: `GET /api/v9/workspaces/{workspace_id}`
- **Projects**: `GET /api/v9/workspaces/{workspace_id}/projects`
- **Clients**: `GET /api/v9/workspaces/{workspace_id}/clients`
- **Members**: `GET /api/v9/organizations/{org_id}/workspaces/{workspace_id}/workspace_users`
- **Time Entries**: `GET /api/v9/me/time_entries` (per user) or Reports API for bulk
- **Reports API**: `POST /reports/api/v3/workspace/{workspace_id}/search/time_entries`
- **Tags**: `GET /api/v9/workspaces/{workspace_id}/tags`

### 7.2 Authentication

- API Token-based auth (Basic auth with API token as username, "api_token" as password)
- Krista's account credentials provided for initial access

---

## 8. Implementation Priority

### Phase 1: Core Time Tracking
1. Time entry model and API endpoints
2. Timer UI (start/stop, manual entry)
3. Project-member rate configuration
4. Basic role-based access (admin sees all, consultant sees own)
5. Daily/weekly time entry view

### Phase 2: Reports and Invoice Prep
1. Client Invoicing Report (grouped by project > consultant > week)
2. Consultant Billing Report (grouped by consultant)
3. Summary Report with charts
4. Invoice preparation tool (auto-aggregate, concatenate, dedupe)
5. Export to CSV/Excel

### Phase 3: Toggl Data Migration
1. Connect to Toggl API
2. Import all historical time entries
3. Map Toggl projects/clients to NHS entities
4. Validate imported data

### Phase 4: QuickBooks Integration
1. Generate QuickBooks-compatible invoice format
2. QuickBooks API connection (OAuth2)
3. Push draft invoices to QuickBooks
4. Approval workflow before sending

---

## 9. Key Design Decisions Needed

1. **Should time tracking be a separate page or integrated into the existing Projects page?**
   - Transcript suggests: separate page that "almost looks just like Toggl"

2. **How to handle the two-rate system in the UI?**
   - Client rate: set at project level (visible to admin only)
   - Consultant rate: set per project-member (visible to admin only)
   - Consultants see neither rate — they just log time

3. **Invoice preparation workflow**
   - Auto-generate draft → Krista reviews/edits → Approve → Push to QuickBooks
   - Need UI for editing aggregated descriptions

4. **Historical data**
   - Import via Toggl API or manual CSV import?
   - How to handle projects that span the transition period?

5. **QuickBooks integration depth**
   - Start with export-only (CSV/Excel that matches QB format)
   - Graduate to API integration once workflow is validated
