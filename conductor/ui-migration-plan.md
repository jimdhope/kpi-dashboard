# UI Migration Plan (V3 -> V2 Parity)

## Objective
Migrate remaining V3 workspace pages to match the V2 glassmorphic design standard using ShadCN and Tailwind CSS, ensuring 1:1 feature parity.

## Design Standard
- **Base Style:** Glassmorphism (`.glass-card` class).
- **UI Library:** ShadCN UI (Dark mode).
- **Reference:** `v3/src/components/dashboard-overview.tsx`.
- **Constraint:** Do NOT upgrade Tailwind CSS to v4.

## Migration Targets

### 1. Profile Page (`/profile`)
- **V3 Component:** `v3/src/components/profile-form.tsx`
- **V2 Reference:** `v2/src/components/user-form.tsx`
- **Action:** Replace raw CSS (`form-card`, `field`) with `Card`, `Label`, `Input`, `Button`.

### 2. Campaigns Page (`/campaigns`)
- **V3 Component:** `v3/src/components/campaigns-admin.tsx`
- **V2 Reference:** `v2/src/components/campaign-form.tsx` (and potentially list views)
- **Action:** Refactor list and create/edit forms to use Glassmorphic tables and dialogs/cards.

### 3. Pods Page (`/pods`)
- **V3 Component:** `v3/src/components/pods-admin.tsx`
- **V2 Reference:** `v2/src/components/pod-form.tsx`
- **Action:** Apply standard table/card layouts for pod management.

### 4. Trackers Page (`/trackers`)
- **V3 Component:** `v3/src/components/trackers-admin.tsx`
- **V2 Reference:** `v2/src/components/tracker-card.tsx`, `v2/src/components/tracker-kpi-form.tsx`
- **Action:** Ensure tracker configuration uses the new UI components.

### 5. Users Admin (`/admin/users`)
- **V3 Component:** `v3/src/components/users-admin.tsx`
- **V2 Reference:** (Likely part of an admin section or direct Firestore management in V2, check `v2/src/app` if needed)
- **Action:** Standardize user table and role management.

### 6. Manage Competitions (`/competitions/manage`)
- **V3 Component:** `v3/src/components/competitions-admin.tsx`
- **V2 Reference:** (Check `v2/src/components` for competition related forms)
- **Action:** Standardize competition creation and management forms.

### 7. Reports (`/reports`)
- **V3 Component:** `v3/src/components/reports-overview.tsx`
- **V2 Reference:** `v2/src/components/reports/*`
- **Action:** Ensure charts and data grids are glassmorphic.

### 8. Teams Integration (`/integrations/teams`)
- **V3 Components:** `v3/src/components/teams-automation-admin.tsx`, `v3/src/components/teams-webhooks-admin.tsx`
- **V2 Reference:** `v2/src/components/manage-team-agents-dialog.tsx`, `v2/src/components/teamsWebhookAdaptiveCard.json`
- **Action:** Style the integration configuration panels.

### 9. Notifications (`/notifications`)
- **V3 Component:** `v3/src/components/notifications-panel.tsx`
- **V2 Reference:** `v2/src/components/notifications/*`
- **Action:** Style notification list and preferences.

### 10. Minigames (`/games/rps`)
- **V3 Path:** `v3/src/app/games`
- **Action:** Ensure game interface fits the glass theme.

## Execution Workflow
For each component:
1. **Analyze:** Read V2 reference and current V3 code.
2. **Refactor:** Apply ShadCN components and `.glass-card` styles.
3. **Verify:** Check code structure and import correctness.
