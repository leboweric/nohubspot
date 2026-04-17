# Toggl Layout Details (from screenshot)

## Entry Row Structure (left to right):
1. Checkbox (for bulk select) — small, left edge
2. Group count badge ("2", "3") — if entries are grouped
3. "Add des..." placeholder or description text — NOT flex-1, just fits its content
4. Colored dot + Project name in color + Client name in gray — IMMEDIATELY after description, no gap
5. $ billable icon
6. Time range "1:44 PM - 5:48 PM"
7. Duration "4:04:20"
8. Hover actions (play, pin, kebab menu)

## KEY INSIGHT: The left side (description + project) is a LEFT-ALIGNED group
## The right side (billable + time + duration + actions) is a RIGHT-ALIGNED group
## There is NO flex-1 expanding the description to fill the width
## Instead: left group takes what it needs, right group is pushed to the right edge
## The "gap" between them is just natural space, not forced expansion

## Toggl uses a TWO-COLUMN approach:
## Left column: description + project (both left-aligned, adjacent)
## Right column: $, time range, duration, actions (right-aligned, fixed width)

## Row height: approximately 32-34px
## Font size: ~13px for description, ~12px for project name, ~11px for time range
## The project text is colored (e.g., red/pink for SCC Internal Work)
## Client name is in lighter gray after project name
