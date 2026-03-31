# Phase 4: Performance Rollups & High-Speed Views

## 1. Goal
Implement the core analytics logic for "Scottish Power" rules and generic KPI tracking. This moves V3 from a simple "CRUD" app to a data-driven performance tracker.

## 2. Technical Strategy
- **Service Layer**: `trackerService` handles input validation and complex aggregations.
- **Rollup Tables?**: Not for Phase 4; we'll use Prisma `groupBy` and `sum` for small/medium datasets. If performance degrades, we'll implement a materialized view or sync table.
- **Rules Engine**: Standardize the V2 `dailyPodTargets` into `TrackerKpi` / `Rule` logic.

## 3. Implementation Plan

### 4.1: Performance Services & Actions
- [ ] Create `TrackerRepository` for raw data access.
- [ ] Create `TrackerService` for business logic (e.g., "Get daily stats for Pod X").
- [ ] implement `logPerformance` server action.

### 4.2: KPI Hub UI
- [ ] Port the "Performance" page from V2.
- [ ] Implement `<Sparkline />` and `<ProgressBar />` components.

### 4.3: Real-time Dashboards
- [ ] Add "Current Pod Standings" to the main dashboard.
- [ ] Add "Personal Achievement Streak" logic.
