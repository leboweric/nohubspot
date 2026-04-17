# Time Tracking UI Issues from Screenshot (Apr 17, 3:27 PM)

## Critical Issues
1. **Dark background** — entire page has dark/charcoal background (#1a1a2e or similar), clashing with NHS's white theme
2. **Most entries missing project names** — only ~4 out of 20+ visible entries show a project (colored dot + name)
3. **Timer bar area** has dark background too — "What are you working on?" input, "Add a project" dropdown
4. **Stats bar** (TODAY TOTAL / WEEK TOTAL) shows 0:00:00 for both — may be correct if no entries today

## Layout Issues  
5. **Entries are too tall** — each row has too much vertical padding, wasting space
6. **Project names truncated** — the ones that do show are cut off (e.g., "SCC Internal Work (team..." "Strategic C...")
7. **No visible hover actions** — no play/edit/delete buttons visible
8. **Day headers** ("Tue, Apr 7", "Mon, Apr 6") look okay but the total hours on right are hard to read

## Data Issues
9. **Many entries have no description** — showing "Add description" placeholder text in gray
10. **Billable indicator ($)** is present on most entries — looks correct
11. **Time ranges** are showing correctly (e.g., "8:00 PM - 6:00 PM", "4:55 PM - 5:15 PM")
12. **Duration** column is showing correctly

## What's Working
- Timer bar structure is there (description input, project selector, timer display, play button)
- Day grouping is working
- Entries are sorted by date descending
- The green play button in the timer bar is visible
- Navigation shows "Time Tracking" between Projects and Bulk Email
