# Spreadsheet Analysis - Toggl Exports

## Client Invoicing Report (407 rows, 32 projects)
- **Structure**: Grouped by Project (with client rate in title), then individual time entries
- **Columns**: Project/Time entry, Task, User, Tags, Start date/time, Stop date/time, Time (h), Time (decimal), Billable
- **Project naming convention**: "Client Name - Project Type - $Rate/hr"
  - e.g., "Amery Area Community Center - Grants Work - $75/hr"
  - e.g., "Girl Scouts River Valleys - Corporate/Foundation Grant Writing - $75/hr"
- **Client billing rates**: $75, $125, $135, $140, $150/hr (varies by project type)
- **13 active consultants** tracking time

## Consultant Billing Report (270 rows, 13 consultants + total)
- **Structure**: Grouped by Member (consultant), then individual time descriptions
- **Columns**: Member, Description, Hourly rate, Duration, Duration %, Amount (USD)
- **Period**: 03/01/2026 - 03/31/2026
- **Key insight**: Consultant billing rates are DIFFERENT from client rates
  - Consultants have multiple rates depending on the project type
  - e.g., Akishbailey: $45, $50, $71, $85/hr (varies by what they're doing)
  - e.g., Roanderson: $85/hr flat

## Two-Rate System
- **Client rate**: What the client pays (embedded in project title) - e.g., $150/hr
- **Consultant rate**: What the consultant bills SCC - e.g., $85/hr
- **Margin**: SCC keeps the difference
- Toggl only supports ONE billing rate per project, so they run TWO separate reports:
  1. Client Invoicing report (uses client rate from project title)
  2. Consultant Billing report (uses consultant's billing rate)

## Consultants
| Username | Consultant Rates |
|----------|-----------------|
| Akishbailey | $45, $50, $71, $85 |
| Cecily Harris | $45, $71, $79 |
| Cjensen | $76.68, $85 |
| Ctaykalo | $45, $50, $71, $85 |
| Dbartholomay | $45, $85 |
| Dmarty | $45, $85 |
| Ellen Gibson Freelance | $50, $71 |
| Idavis | $45, $50, $71, $85 |
| Jhipple | $60, $85 |
| Kharding | $45, $85 |
| Molly Schwartz | $45, $85 |
| Roanderson | $85 |
| Smarschalk | $45, $85 |
