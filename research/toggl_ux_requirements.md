# Toggl UX Replication Requirements (from Transcript)

## Key Quotes
- "100%" — when asked if it should look just like Toggl (line 43)
- "it'll be basically the same thing" (line 179)
- "no excuses anymore. I don't want to learn two systems" (line 80)

## Exact UX Elements to Replicate

### Timer Bar (Top of Page)
- Description text field (left side)
- Project selector dropdown (with search)
- Billable toggle ($)
- Timer display (HH:MM:SS counting up)
- Start/Stop button (green play / red stop)

### Time Entry List (Below Timer)
- **Grouped by day** with date header showing day name, date, and total hours
- Each entry row shows: description, project name (with colored dot), duration, and action icons
- Entries are editable inline
- Can click play on any past entry to resume it (start a new entry with same project/description)

### Project Selector
- Dropdown with search
- Shows project name with client name underneath
- Colored dots per project

### What Consultants See
- Only their own time entries
- Timer, their entries, that's it
- Cannot see other people's time or rates

### What Project Managers See
- Their own time + all entries on projects they manage
- Can see hours vs budget for their projects

### What Admin (Krista) Sees
- Everything — all users, all entries, all rates, all reports

### Reports (Admin Only)
- Consultant Billing: grouped by consultant, shows their pay rate, total hours, total amount
- Client Invoicing: grouped by project (which has client billing rate in title), shows entries by consultant by week, with descriptions concatenated and deduped
