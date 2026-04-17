# Critical Toggl vs NHS Comparison

## What Toggl ACTUALLY looks like (from live screenshot):

### Layout Structure:
1. **LEFT SIDEBAR** (180px) - not top nav! Contains: TRACK (Overview, Timer), ANALYZE (Reports, Approvals), MANAGE (Projects, Clients, Members, etc.)
2. **MAIN CONTENT** fills remaining width (~720px on 900px viewport)
3. **Timer bar** at top of main content area
4. **Stats bar** below: "TODAY TOTAL 4:04:20  WEEK TOTAL 6:57:45"
5. **Tab bar**: Calendar | List view | Timesheet
6. **Colored project bar** spanning full width below tabs (green bar for current project)

### Entry Row Layout (THIS IS KEY):
- **Checkbox** on far left (for bulk actions)
- **Group count badge** ("2", "3") in a circle
- **Description** "Add des..." - SHORT, truncated, NOT filling space
- **Colored dot + Project name** "SCC Internal Work (team meetings, proposal/contract work, etc.)" - THIS FILLS THE MIDDLE
- **Client name** "Strategic Consulting & Coaching" in gray after project
- **$ billable icon** 
- **Time range** "1:44 PM - 5:48 PM"
- **Duration** "4:04:20"
- **Action icons** (play, more menu)

### CRITICAL DIFFERENCES FROM NHS:
1. **LEFT SIDEBAR vs TOP NAV** - This is the #1 difference. Toggl uses sidebar, NHS uses top nav. This means Toggl entries get the full width minus 180px sidebar, while NHS entries get full width minus nothing, but the top nav takes vertical space.
2. **EVERY entry in Toggl has a project** - "SCC Internal Work" is the catch-all project. In NHS, most entries have NO project, creating the white gap.
3. **Entry grouping** - Toggl groups identical entries with a count badge ("2", "3"). NHS shows every entry individually.
4. **Checkboxes** for bulk selection on left side
5. **Tab bar** with Calendar/List/Timesheet views
6. **Colored project bar** spanning full width showing current active project

### THE REAL PROBLEM:
The white space gap in NHS is NOT a layout issue - it's because most imported entries have no project. In Toggl, Krista assigns EVERY entry to a project. The "SCC Internal Work" project is the catch-all. When we imported, many entries lost their project mapping. We need to:
1. Fix the data - map orphaned entries to their correct projects
2. OR at minimum, the layout needs to handle no-project entries gracefully by not leaving a gap
