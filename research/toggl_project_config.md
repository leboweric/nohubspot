# Toggl Project Configuration Details

## Project Edit Dialog Fields
1. **Project Name** (text input) - e.g., "Board Bylaw Review - $150/hr"
2. **Color** (color picker) - project color for visual identification
3. **Privacy** toggle - "Private, visible only to project members"
4. **Client** (searchable dropdown) - e.g., "Minnesota Metro North Tourism dba Twin Cities Gateway Visitors Bureau"
5. **Timeframe** - Start date (10/04/2023) and optional end date ("no end date")
6. **Recurring** toggle - off/on
7. **Time Estimate** toggle - off/on (when on, can set estimated hours)
8. **Billable** toggle - on/off, with rate config: "using Workspace rates ($ USD/h)" with dropdown to change

## Project Sub-pages
- **Dashboard** - project overview
- **Tasks** - task list (can add tasks within a project)
- **Team** - team members assigned to this project

## Key Observations
- The client billing rate ($150/hr) is embedded in the PROJECT NAME, not in the billable rate field
- The "Billable" setting says "using Workspace rates" which is the default
- This means the actual billable rate shown in reports comes from workspace-level rate settings
- Projects can have tasks within them (sub-categorization)
- Projects have a timeframe (start/end date) for tracking project duration
- Privacy controls exist per project
- Total Hours, Billable Hours, and Billable Amount shown on project detail page

## Team Tab - Per-Project Member Configuration
Example: "Board Bylaw Review - $150/hr" project

| Member | Rate | Cost (PREMIUM) | Role |
|--------|------|----------------|------|
| Kharding | 85 USD | - | Manager (Views all entries) |
| Molly Schwartz | 85 USD | - | (regular) |
| Roanderson | - | - | Manager (Views all entries) |

### Key Insights:
- Each member can have a **per-project billable rate** (separate from workspace rate)
- **Cost** column is a PREMIUM feature (not used here)
- Members can have **Manager** role (views all entries) or regular role
- The RATE shown here (85 USD) is different from the client rate ($150/hr in project name)
- This confirms the TWO-RATE SYSTEM:
  - **Client rate** = $150/hr (in project name, used for client invoicing)
  - **Consultant rate** = $85/hr (per-member rate, used for consultant billing)
- Not all members have rates set (Roanderson shows "-")
