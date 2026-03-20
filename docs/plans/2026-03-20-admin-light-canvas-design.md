# Admin Light Canvas Redesign

## Goal
Reskin the admin mission control canvas from dark space theme to light, clean design matching the landing page aesthetic.

## Approach
Approach A: Light Canvas — keep ReactFlow canvas + all functionality, restyle visuals.

## Design Spec

### Color Mapping
| Element | Dark (Before) | Light (After) |
|---------|--------------|---------------|
| Page bg | `#08081a` | `#faf9f6` |
| Card bg | `rgba(12,12,30,0.95)` | `#ffffff` |
| Text primary | `#ffffff` | `#0b0707` |
| Text secondary | `rgba(255,255,255,0.5)` | `#3b3b3b` |
| Borders | `rgba(255,255,255,0.05)` | `#efeff1` |
| Accent | Neon dept colors | `#fe5b25` orange + softer dept colors |
| Glow effects | Heavy | None |

### Top Bar
- White background, `border-b border-[#efeff1]`
- Logo: "LEAD EXPRESS" in `#0b0707`, orange dot accent
- "LIVE OPS" badge: `#fe5b25` bg, white text
- KPI pills: White cards, subtle border, dark bold numbers, `#3b3b3b` labels
- Profile: Dark text

### Canvas Area
- Background: `#faf9f6` with light dot grid
- No ambient glow spots
- ReactFlow controls: Light theme

### Department Cards (Nodes)
- White bg, `shadow-md hover:shadow-lg`, `border border-[#efeff1]`
- Top accent line: department color (softer)
- `rounded-2xl`
- KPI numbers: department color, no glow/text-shadow
- Labels: `#3b3b3b`
- Urgency badge: orange URGENT, green ACTIVE, gray IDLE
- Watermark icon: `opacity-[0.04]` gray
- Hover: `-translate-y-1` + shadow-lg
- Footer "ENTER": orange `#fe5b25`

### Edges
- Light gray `#e5e5e5` dashed, no animation

### Bottom Bar
- White bg, `border-t border-[#efeff1]`
- Dark text, orange active indicators
- "LIVE" badge: orange bg, white text

### Department Layout (drill-down)
- White nav bar, cream content area
- Orange active tab underline

## Files to Modify
1. `apps/dashboard/src/components/admin/AdminCanvas.tsx` — main canvas, top bar, bottom bar
2. `apps/dashboard/src/components/admin/DepartmentNode.tsx` — card styling
3. `apps/dashboard/src/components/admin/DepartmentLayout.tsx` — drill-down layout
