# Contractor Service Settings — Page Redesign

## Summary

Replace the basic Profile page with a rich "Service Settings" page where contractors manage their professions, coverage areas (ZIP codes), and working schedule. Includes a Google Map showing coverage zones and recent leads.

## Layout

Two-column layout inspired by dispatch/scheduling dashboards:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚙️ Service Settings                              [💾 Save] │
├────────────────────┬─────────────────────────────────────────┤
│  LEFT PANEL (350px)│  RIGHT AREA (flex-1)                    │
│                    │                                         │
│  ┌──────────────┐  │  ┌─────────────────────────────────┐    │
│  │ Professions  │  │  │                                 │    │
│  │ (toggle grid)│  │  │   GOOGLE MAP                    │    │
│  └──────────────┘  │  │   - ZIP polygons (colored)      │    │
│                    │  │   - Lead pins (recent)           │    │
│  ┌──────────────┐  │  │   - Click to add/remove areas   │    │
│  │ ZIP Codes    │  │  │                                 │    │
│  │ (tag input)  │  │  └─────────────────────────────────┘    │
│  └──────────────┘  │                                         │
│                    │  ┌─────────────────────────────────┐    │
│                    │  │ Working Days & Hours             │    │
│                    │  │ (7-day grid with time ranges)   │    │
│                    │  └─────────────────────────────────┘    │
└────────────────────┴─────────────────────────────────────────┘
```

On mobile: stacks vertically (map first, then professions, ZIPs, schedule).

## Components

### 1. Professions Grid (Left Panel)
- Grid of toggle chips/cards (2 columns)
- Each shows emoji + name (EN/HE)
- Multi-select — click to toggle
- All 20 professions from the parser: hvac, air_duct, chimney, dryer_vent, garage_door, locksmith, roofing, plumbing, electrical, painting, cleaning, carpet_cleaning, renovation, fencing, landscaping, tiling, kitchen, bathroom, pool, moving

### 2. ZIP Codes (Left Panel)
- Tag-style input: type ZIP, press Enter to add
- Each tag shows ZIP with ✕ to remove
- Adding/removing a ZIP updates the map polygons in real-time
- Syncs bidirectionally with map clicks

### 3. Google Map (Right, Top)
- @react-google-maps/api or @vis.gl/react-google-maps
- Shows ZIP code boundaries as colored polygons
- Lead pins: recent leads in coverage area (last 7 days)
- Click on map area to add/remove ZIP codes
- Auto-centers on contractor's coverage area

### 4. Working Schedule (Right, Bottom)
- 7-row grid (Sun–Sat)
- Each row: day name | toggle on/off | start time picker | end time picker
- Disabled days grayed out
- Default: Mon–Fri 09:00–18:00

## Data Model

Uses existing `contractors` table:
- `professions: text[]` — already exists
- `zip_codes: text[]` — already exists
- `working_days: text[]` — already exists (day names)
- New columns needed:
  - `working_hours: jsonb` — e.g. `{"mon": {"start": "09:00", "end": "18:00"}, ...}`

## Tech Stack
- React + Tailwind (existing)
- Google Maps JavaScript API via `@vis.gl/react-google-maps`
- ZIP boundary data: US Census ZCTA GeoJSON (loaded on demand)
- Supabase for persistence

## Route
- `/settings` — new route in App.tsx
- Profile page keeps personal info (name, phone, email)
- Settings page handles service configuration
