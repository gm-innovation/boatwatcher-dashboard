

# Dashboard Layout Correction

## Current vs Reference

The current dashboard has extra sections (QuickActions, DeviceStatus, Alerts, RecentActivity) and its own title/refresh controls that don't match the reference. The reference shows a clean, minimal layout:

1. **Header** already contains navigation + refresh controls (Atualizado, Atualizar, Auto) -- this is correct
2. **Project selector** below header -- already exists in Header
3. **Dashboard body** should only contain:
   - ProjectInfoCard (full width)
   - 3 StatisticsCards (horizontal row)
   - Workers table (~60%) + Companies list (~40%) side by side

## Changes

### 1. Simplify `Dashboard.tsx`
- Remove the "Dashboard" title and duplicate refresh controls (lines 87-124) -- these are already in the Header
- Remove `QuickActionsPanel` 
- Remove `DeviceStatusPanel` and `AlertsPanel` from the main grid
- Remove `RecentActivityFeed`
- Change grid layout: Workers table takes `xl:col-span-3`, Companies list takes `xl:col-span-2` in a 5-column grid (roughly 60/40 split)
- Keep fullscreen toggle logic but move it to be less prominent

### 2. Adjust `Header.tsx` refresh controls
- The Header already has an "Atualizar" button and clock. Need to connect the refresh button to actually trigger dashboard data refresh, and add the "Auto" toggle to the header controls area (matching the reference: "Atualizado: 10:50:36 | Atualizar | Auto")

### 3. Move refresh state to `ProjectContext`
- Add `lastUpdate`, `autoRefresh`, `handleRefresh` to ProjectContext so both Header and Dashboard can share this state

### Files to modify:
- `src/components/dashboard/Dashboard.tsx` -- simplify layout
- `src/components/Header.tsx` -- add Auto toggle, connect refresh
- `src/contexts/ProjectContext.tsx` -- add shared refresh state

