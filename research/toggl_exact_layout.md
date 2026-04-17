# Toggl Exact Entry Row Layout (from DOM inspection)

## Row container: 1041px wide, 50px tall, display:flex, align-items:center, padding-left:20px

## 9 flex items in order:

| # | Width | Flex | Content | Purpose |
|---|-------|------|---------|---------|
| 0 | 30px  | 0 0 auto | (empty) | Checkbox |
| 1 | 30px  | 0 0 auto, margin-right:10px | "2" | Group count badge |
| 2 | 81px  | 0 1 auto | "Add description" | Description text (shrinks, doesn't grow) |
| 3 | 469px | **1 1 auto** | "SCC Internal Work..." | **Project selector (THIS IS THE FLEX GROWER)** |
| 4 | 50px  | 0 2 auto | (empty) | Spacer/tags area |
| 5 | 30px  | 0 0 auto | (empty) | Billable button |
| 6 | 252px | 0 0 auto | "4:04:20 1:44 PM - 5:48 PM" | Duration + time range |
| 7 | 40px  | 0 0 auto | (empty) | Play/continue button |
| 8 | 30px  | 0 1 auto | (empty) | More menu |

## CRITICAL INSIGHT:
The **PROJECT SELECTOR** (item 3) is the flex grower (flex: 1 1 auto), NOT the description!
The description is flex: 0 1 auto — it takes only the width it needs and can shrink.
The project name FILLS the remaining space. This is why there's no white gap — the project
name expands to fill whatever space is left between the description and the right-side controls.

## Font sizes:
- Description: 14px, color rgb(1,1,1)
- Project name: 14px (inside the project selector)
- Duration/time: inside the 252px fixed container

## Row height: 50px (not 34px like I was using!)
## Padding: 0 0 0 20px (left padding only)
