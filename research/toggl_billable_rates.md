# Toggl Billable Rates Configuration

## 5 Levels of Billable Rates (most general → most granular)
1. **Workspace rate** (most general) - applies to every member
2. **Workspace member rate** (PREMIUM) - per-member override
3. **Project rate** - per-project, overrides workspace rates
4. **Project member rate** - per-member within a project
5. **Task-specific rate** (most granular) - per-task within a project

The system applies the MOST GRANULAR rate available.

## Current Workspace Configuration
- **Workspace Rate**: 0 USD/hr (Billable by default)
- **Currency**: USD

## Workspace Member Rates (PREMIUM feature)
| Member | Hourly Rate | Cost |
|--------|-------------|------|
| Akishbailey | - | - |
| Cecily Harris | - | - |
| Cjensen | - | - |
| Ctaykalo | - | - |
| Dbartholomay | - | - |
| Dmarty | - | - |
| Ellen Gibson Freelance | - | - |
| Idavis | - | - |
| Jhipple | - | - |
| **Kharding** | **45 USD** | - |
| Molly Schwartz | - | - |
| Roanderson | - | - |

**Note**: Only Kharding has a workspace-level member rate set (45 USD/hr). All others show "-".

## Project Rates
Projects are listed with their hours but no explicit project-level rates shown in this view.
The rates appear to be set at the project-member level (seen in the Team tab of each project).

## Key Insight: How Rates Actually Work for SCC
From the spreadsheet analysis:
- **Client billing rates** are embedded in project names (e.g., "$150/hr", "$125/hr", "$75/hr")
- **Consultant pay rates** are set per-member per-project (seen in Team tab, e.g., $85/hr)
- The Toggl "billable amount" in reports uses the project-member rate
- The actual client invoice uses the rate from the project name

This means there's a DISCONNECT between:
- What Toggl calculates (using project-member rates like $85/hr)
- What the client is billed (using the rate in the project name like $150/hr)

The client invoicing spreadsheet manually applies the correct client rate.
