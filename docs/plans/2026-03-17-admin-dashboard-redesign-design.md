# Design Doc: Admin Dashboard Redesign (Apple Floating Glass Style)

## Overview
Redesign the main Admin Dashboard to achieve a high-end, "Apple-style" aesthetic. The focus is on a clean, light, and futuristic interface that feels like a premium product (e.g., iCloud, Apple Store, or visionOS).

## Aesthetic Direction: "The Pure Canvas"
- **Theme**: Ultra-light, high-contrast minimalism.
- **Material**: Glassmorphism (Floating Glass).
- **Core Elements**: 
  - Background: `#FBFBFD` (Apple's signature off-white) with a subtle grain texture.
  - Cards: Semi-transparent white (`rgba(255, 255, 255, 0.8)`) with `backdrop-filter: blur(24px)`.
  - Borders: Ultra-thin hairline borders (`1px solid rgba(0, 0, 0, 0.05)`).
  - Shadows: Multi-layered soft shadows to create depth without clutter.
  - Corners: Large, friendly radii (24px - 32px).

## Typography & UI Elements
- **Font**: `Outfit` (existing) with refined weights.
  - Headers: Thin/Light (200-300) for elegance.
  - KPIs: Bold (700) for impact.
- **Icons**: Lucide icons, but styled with soft, monochromatic gradients or subtle deep pastels.
- **Color Palette**:
  - Primary: `#007AFF` (Apple Blue) for actions.
  - Hot Status: Soft Coral/Red.
  - Success: Sage Green.
  - Muted: Slate Grey for labels.

## Components to Redesign
1. **AdminSidebar**: Update to match the glass style, with smoother transitions and refined active states.
2. **KPI Cards**: Transform into "Glass Tiles" with staggered entrance animations.
3. **Recent Leads Table**: Convert into a clean, spaced-out list with hover-lift effects.
4. **System Alerts**: Style as refined "Notices" that float at the top or in a dedicated grid.

## Motion & Interaction
- **Entrance**: Staggered fade-in and slide-up for all dashboard elements.
- **Hover**: Cards should "lift" (scale 1.02 + shadow growth) on hover.
- **Transitions**: Smooth 300ms-500ms cubic-bezier transitions for all state changes.

## Success Criteria
- The dashboard feels significantly more premium and "designed."
- Information hierarchy is clearer despite the minimal aesthetic.
- Performance remains high (efficient CSS filters).
