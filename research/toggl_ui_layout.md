# Toggl Timer Page - Exact UI Layout

## Timer Bar (Fixed at top)
- Full-width bar with white/light background
- Left: "What are you working on?" placeholder text input (large, takes most of the width)
- Middle-right area: Project selector button, Tag selector, Dollar sign ($) billable toggle
- Right: Timer display "0:00:00" in dark text, large green play button (circle with triangle)
- Manual mode toggle icon at far right

## Below Timer Bar - Stats Row
- "All dates" dropdown filter
- "TODAY TOTAL 4:04:20" link
- "WEEK TOTAL 6:57:45" link  
- View toggle: Calendar | List view | Timesheet (radio buttons, "List view" is default/selected)
- Settings gear icon, expand/collapse icon

## Time Entry List - Grouped by Day
### Day Header Row
- Checkbox (for bulk select)
- Day label: "Today", "Yesterday", "Wed, 15 Apr" etc.
- Right side: Total hours for that day (e.g., "4:04:20")

### Entry Row Layout (left to right)
- Group indicator (number badge like "2" if entries are grouped)
- "Add des..." text (description, editable inline)
- Colored dot (project color) + Project name in colored text + Client name in gray
- "$" billable indicator
- Time range "1:44 PM - 5:48 PM"
- Duration "4:04:20"
- Play button (to resume/restart this entry)
- Three-dot menu (more options)

### Colors
- Project names shown in MAGENTA/PINK color
- Client names in lighter gray
- Green play button for start
- Purple/dark sidebar on left
- White/light gray background for entries
- Day headers have light background
- Colored progress bar at top of entry group (matches project color)

### Grouped Entries
- When multiple entries have same description, they show a number badge
- Expandable to see individual entries
- Shows combined duration

## Left Sidebar Navigation
- TRACK section: Overview, Timer
- ANALYZE section: Reports, Approvals
- MANAGE section: Projects, Clients, Members, Billable rates, Invoices, Tags, Goals, Integrations
- Bottom: Subscription, Settings
