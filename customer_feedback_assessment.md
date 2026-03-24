# Customer Feedback Assessment: Pipeline & Project Tracking

## Summary

After reviewing the codebase against each of the customer's 6 questions, here's my assessment with what's a bug, what's a quick fix, and what needs a deeper conversation.

---

## 1. "Won This Month" — Can they see YTD wins and losses?

**Current behavior:** The "Won This Month" metric in `PipelineStats.tsx` filters deals where `stage_name` includes "Won" and `updated_at >= first of current month`. There is no YTD view.

**Assessment:** This is a **feature enhancement**. We'd need to add a date range toggle (Month / Quarter / YTD / All Time) to the pipeline stats bar. The data is already there — it's just a filter change on the frontend.

**Effort:** Low-medium. Add a dropdown/toggle to PipelineStats that changes the date range filter. Could also add a "Lost This Month" / "Lost YTD" companion metric.

**Recommendation:** Good ask. I'd add a simple toggle: "This Month | This Quarter | YTD" that adjusts both the Won and Lost counts. Quick win.

---

## 2. Closed proposals showing as "Overdue"

**Current behavior:** This is a **bug**. In `DealCard.tsx`, the `getHealthStatus()` function checks:
```js
if (closeDate && closeDate < now && deal.stage_name !== 'Closed Won') {
  return { status: 'overdue', ... }
}
```
It only excludes "Closed Won" — it does NOT exclude "Closed Lost". So any deal in the "Closed Lost" stage with a past expected close date shows as "Overdue."

Additionally, the `getDealsForStage()` function in `KanbanBoard.tsx` filters by `deal.is_active`, but deals in Closed Won/Lost stages are still marked `is_active = true` in the database. They show up in the board with overdue badges.

**Fix:** Two changes needed:
1. Update the overdue check to also exclude "Closed Lost": `deal.stage_name !== 'Closed Won' && deal.stage_name !== 'Closed Lost'` (or better: check if the stage's `is_closed` flag is true)
2. The overdue logic in `PipelineStats.tsx` already excludes Won but not Lost — same fix needed there

**Effort:** Low. Quick code fix, 15 minutes.

**Recommendation:** This is a legit bug. I can fix it right now if you want.

---

## 3. What is "Hot Prospect" in Active Deals?

**Current behavior:** In `PipelineStats.tsx`:
```js
hotDeals: activeDeals.filter(d => d.probability >= 70).length
```
A "hot prospect" is any active deal with a **probability of 70% or higher**. It's displayed as a subtitle under the Active Deals count.

**Assessment:** The logic is fine, but the customer doesn't know what it means because there's no tooltip or explanation in the UI.

**Recommendation:** Add a tooltip/hover explanation: "Deals with 70%+ close probability." Could also consider making the threshold configurable in Settings. Easy fix — just add a title attribute or info icon.

---

## 4. Active Deals count includes Closed Won/Closed Lost

**Current behavior:** In `PipelineStats.tsx`:
```js
const activeDeals = deals.filter(d => d.is_active)
```
The `is_active` flag is a general "not deleted" flag — it does NOT mean "not closed." Deals in Closed Won and Closed Lost stages still have `is_active = true`. So the Active Deals metric counts ALL non-deleted deals, including closed ones.

**Assessment:** This is a **bug / misleading metric**. The "Active Deals" card should only count deals in non-closed stages.

**Fix:** Filter out deals in closed stages:
```js
const activeDeals = deals.filter(d => d.is_active && !d.stage_name?.includes('Closed'))
```
Or better, use the stage's `is_closed` property from the stages array.

**Effort:** Low. Same 15-minute fix as #2.

**Recommendation:** Definitely fix this. The metric is misleading. Should only show deals in Qualified, Proposal, and Negotiation stages (or any stage where `is_closed = false`).

---

## 5. Remove "Planning" and "Wrapping Up" columns from Project Tracking

**Current behavior:** The default project stages are defined in the backend (`main.py` line 2966-2970):
- Planning (position 0)
- Active (position 1)
- Wrapping Up (position 2)
- Closed (position 3)

These are stored in the `project_stages` database table per organization. The stages are fully CRUD-able — there are endpoints to create, update, and delete stages.

**Assessment:** This is **already possible** through the API. However, there may not be a UI for managing project stages (like a Settings page for stages). The customer could:
- Option A: We delete the "Planning" and "Wrapping Up" stages via the API for their organization (need to move any projects in those stages first)
- Option B: We add a stage management UI in Settings so they can customize it themselves

**Recommendation:** For now, I can delete those stages via the API for this customer. Longer term, adding a "Manage Stages" option in Settings (similar to how pipeline stages might be managed) would be the right move. Ask the customer if they want us to just remove them, or if they want the ability to manage stages themselves.

---

## 6. Ongoing projects / grant writing without definitive project value

**Current behavior:** The Project model supports both `fixed_value` and `hourly_rate * projected_hours` for calculating project value. But both expect a number. There's no concept of "TBD" or "ongoing/indefinite" project value.

**Assessment:** This is a **product/UX conversation**, not a code fix. Options:
- Allow `$0` or blank project value and don't flag it as incomplete
- Add a "Project Value: TBD" or "Ongoing" checkbox that suppresses value-related metrics
- Add a project category like "Retainer" or "Ongoing" that changes how value is displayed
- Add a "Grant Writing" project type that has different fields (e.g., grant amount applied for vs. awarded)

**Recommendation:** This is a good IDS topic. The simplest immediate fix is to allow projects with $0 value without it looking broken. The bigger question is whether they need a different project type with different fields for grant writing vs. consulting engagements. I'd suggest scheduling that conversation.

---

## Priority Summary

| # | Issue | Type | Effort | Priority |
|---|-------|------|--------|----------|
| 1 | YTD wins/losses view | Feature | Low-Med | Medium |
| 2 | Closed deals showing overdue | Bug | Low | **High** |
| 3 | Hot prospect explanation | UX | Low | Low |
| 4 | Active Deals includes closed | Bug | Low | **High** |
| 5 | Remove Planning/Wrapping Up columns | Config | Low | Medium |
| 6 | Ongoing projects without value | Product | Medium | IDS Topic |

**Items 2 and 4 are bugs I can fix immediately.** Items 1, 3, and 5 are quick enhancements. Item 6 needs a conversation.
