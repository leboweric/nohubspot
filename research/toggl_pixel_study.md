# Toggl Pixel-Level Layout Study

## CRITICAL DIFFERENCE: LEFT SIDEBAR
Toggl has a LEFT SIDEBAR (~160px wide) with navigation:
- TRACK section: Overview, Timer
- ANALYZE section: Reports, Approvals
- MANAGE section: Projects, Clients, Members, Billable rates, Invoices, Tags, Goals, Integrations
- Bottom: Subscription, Settings

The sidebar is dark gray/charcoal background. This means the CONTENT AREA is narrower than full width.

## TIMER BAR (top, full width of content area)
- White background
- "What are you working on?" placeholder text (gray) — takes up the LEFT portion
- Right side: project selector, tag icon, billable icon, duration "0:00:00", green play button, manual mode toggle
- Height: ~48px
- Below timer: thin stats bar with "All dates" dropdown, "TODAY TOTAL 4:04:20", "WEEK TOTAL 6:57:45"
- Below stats: view toggles "Calendar | List view | Timesheet" and settings gear

## SUMMARY BAR (below stats)
- Shows a horizontal bar chart of project distribution
- "SCC INTERNAL WORK (TEAM MEETINGS, PROPOSAL/CONTRACT WORK, ETC.)  STRATEGIC CONSULTING & COACHING" in uppercase
- "BOAR..." truncated on right
- This is a colored progress bar showing % breakdown

## DAY GROUPS
- "Today" header with checkbox on left, total "4:04:20" on right
- Light gray background for the header row
- Entries below in white

## ENTRY ROW STRUCTURE (this is the KEY):
Each row has these elements LEFT to RIGHT:
1. Checkbox (for bulk select) — left edge
2. Group count badge "2" (yellow/gold circle) — if grouped
3. "Add des..." or description text — gray placeholder or black text
4. Colored dot (red/pink) + "SCC Internal Work (team meetings, proposal/contract work, etc.)" in RED/PINK text
5. "Strategic Consulting & Coaching" in GRAY text — this is the CLIENT name
6. "$" billable indicator (green)
7. Time range "1:44 PM - 5:48 PM" in gray
8. Duration "4:04:20" in black/dark
9. Hover actions (play, more)

## KEY LAYOUT OBSERVATIONS:
- The description and project ARE on the same row but the project is in the MIDDLE of the row, not at the right edge
- The row uses a CSS grid or fixed columns approach, NOT flexbox with flex-1
- The description takes maybe 15-20% width
- The project+client takes maybe 40-50% width  
- The right section (billable, time, duration) takes maybe 30% width
- There is NO massive white gap — everything is distributed evenly across the row

## COLORS:
- Background: white (#fff)
- Sidebar: dark charcoal
- Project text: red/pink (#e74c3c or similar)
- Client text: gray (#999 or similar)
- Description: dark gray/black
- Time range: gray
- Duration: dark/black
- Day header bg: very light gray
- Billable $: green
- Group badge: gold/yellow circle with white number

## ROW HEIGHT: approximately 36-38px with some padding
## FONT: Sans-serif, ~13-14px for description, ~12-13px for project, ~12px for times
