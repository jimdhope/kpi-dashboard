# V3 Migration Implementation Plan

## Current Status: Re-Verification & Schema Cleanup
The project has successfully reached the "First Milestone" of the controlled V3 rebuild. All core infrastructure and administrative features are operational.

### ✅ Completed
- **Next.js + Postgres Foundation**: Clean Next.js app with Prisma ORM.
- **Unified Identity**: App-owned login, logout, and session management.
- **Resource Management**: Campaigns, Pods, and Memberships are fully implemented.
- **Data Tracking**: Tracker KPI registry and Performance Logging path.
- **Competition System**: Competitions with rules, teams, and entries.
- **Teams Automation Hub**:
    - Centralized Webhook Registry (Incoming/Outgoing).
    - Automation Rules with Event/Scheduled/Recurring modes.
    - Shared Message Templates with versioning.
    - **Fix Applied**: Resolved schema collision in `TeamsAutomation` where the content field `messageTemplate` overlapped with the relation and back-relation names.
- **Verification**: `prisma generate` and `npm run build` are confirmed passing.

---

## 🚀 Phase 2: Feature Parity & Role Logic
The next phase focuses on bringing the remaining V2 features into V3 and refining the user experience for various roles.

### 2.1 Mini Games Implementation
- [ ] **Port RPS Game**: Move the Rock Paper Scissors logic from V2 to V3.
- [ ] **Game Hub**: Create a central destination in the UI for agents to access mini-games.
- [ ] **Activity Integration**: Ensure game results are logged to the activity history.

### 2.2 Role-Specific Dashboards
- [ ] **Agent View**: Streamlined dashboard focused on performance and active competitions.
- [ ] **Manager Views**: Dedicated dashboards for Pod and Campaign managers (porting the logic from V2's segmented routes).
- [ ] **Permissions Enforcement**: Finalize the middleware/logic that restricts access based on `UserRole`.

### 2.3 Activity Feed & Notifications
- [ ] **Rich Activity History**: Implement the "Enhanced Activity Plan" (previously discussed in Conversation logs) into the V3 Postgres schema.
- [ ] **Notification Center**: Fully functional inbox for system alerts and competition updates.

---

## 📂 Phase 3: Data Migration & Cut-over
Preparation for the final move from Firebase to Postgres.

### 3.1 Migration Strategy
- [ ] **Firebase Export**: Utility to extract existing data from Firebase (Users, Competitions, etc.).
- [ ] **Prisma Import**: Script to populate Postgres from the Firebase exports.
- [ ] **Validation Layer**: Verification script to compare record counts and integrity after import.

### 3.2 Deployment & Swap
- [ ] **Staging Verification**: Deploy V3 to a staging environment for UAT.
- [ ] **Production Swap**: Move `v3/` content to root and `v2/` to a legacy archive folder.

---

## 🛠 Next Immediate Actions
1. **RPS Game Port**: Start building the `src/app/games` directory.
2. **Activity System**: Add the `Activity` model enhancements to `schema.prisma`.
3. **Data Migration Script**: Create a basic `prisma/migrate-firebase.ts` utility.
