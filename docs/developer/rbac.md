# RBAC & User Roles - KPI Quest 2

This document explains the Role-Based Access Control (RBAC) system implemented in KPI Quest 2.

## 👥 User Roles

The application supports six distinct user roles, each with varying levels of access to the dashboard, trackers, performance metrics, and mini-games.

| Role | Description |
| :--- | :--- |
| **Admin** | Full access to all features and settings. |
| **Campaign Manager** | Full access to all features across all campaigns. |
| **Pod Manager** | Full access to all features for their assigned pod. |
| **Team Leader** | Admin access to Competitions and Trackers; agent-level access to others. |
| **Competition Runner** | Admin access to Competitions; agent-level access to everything else. |
| **Agent** | Access to personal dashboard, achievement logging, and competitions. |

## 🛠 Implementation Details

The RBAC system is implemented primarily in the `AppNavBar` component (`src/components/app-navbar.tsx`) and through Firestore security rules.

### 1. User Documents

The `roles` field in the user's Firestore document is an array of strings representing their active roles (e.g., `['admin', 'agent']`).

### 2. Role Permissions Mapping

The `AppNavBar` component uses a `rolePermissions` object to define what access each role has to different areas of the app:

```typescript
const rolePermissions: Record<UserRole, Record<string, 'admin' | 'agent' | 'none'>> = {
  admin: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    miniGames: 'admin',
  },
  // ... other roles ...
  agent: {
    competitions: 'agent',
    trackers: 'agent',
    performance: 'agent',
    miniGames: 'agent',
  },
};
```

### 3. Role Priority

When a user has multiple roles, the `getHighestRole` function determines the "primary" role based on a defined priority order:

```typescript
const rolePriority: UserRole[] = [
  'admin',
  'campaignManager',
  'podManager',
  'teamLeader',
  'competitionRunner',
  'agent',
];
```

### 4. Navigation Links

The sidebar links (`visibleNavItems`) are filtered based on the user's highest access level for each item. For example, if a `Team Leader` has `admin` access to `competitions`, they will be redirected to `/competitions` instead of `/agent/competitions`.

## 🛡 Security Enforcement

While the UI is tailored based on roles, security is also enforced via:
- **Client-Side Page Checks**: Page layouts or root components verify the `primaryRole` before rendering protected content.
- **Firestore Security Rules**: Rules in `firestore.rules` should ideally check the `roles` field in the user's document before allowing write operations.

## 🚀 Adding a New Role

To add a new role:
1.  Update the `USER_ROLES` constant in `src/components/user-form.tsx`.
2.  Add a label for the role in `formatRoleForDisplay`.
3.  Define permissions for the new role in `rolePermissions` within `src/components/app-navbar.tsx`.
4.  Optionally add a dashboard link and icon in `roleDashboardHrefs`, `roleDashboardLabels`, and `roleIcons`.
5.  Add the role to the `rolePriority` array.
