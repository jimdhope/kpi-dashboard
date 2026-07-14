# Introduction to KPI Quest

**KPI Quest (v3.5.2)** is an enterprise-grade performance management, competition tracking, and engagement application tailored for sales, support, and operation-focused teams. Built with a modern, high-performance tech stack (Next.js, Prisma, PostgreSQL, Tailwind CSS), it transforms traditional key performance indicators (KPIs) into engaging, real-time gamified experiences.

---

## 🏛️ The Core Pillars

KPI Quest is structured around four foundational pillars, each designed to optimize team productivity, foster positive competition, and improve knowledge sharing.

```
   ┌────────────────────────────────────────────────────────┐
   │                       KPI QUEST                        │
   └───────────────────────────┬────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ PERFORMANCE  │        │   GAMIFIED   │        │   TEAM MS    │
│  TRACKING    │        │ COMPETITIONS │        │ AUTOMATIONS  │
└──────────────┘        └──────────────┘        └──────────────┘
```

### 1. Performance Tracking & Logging
* **KPI Performance:** Log daily numerical data across core business indicators (e.g., calls made, issues resolved, sales volume).
* **Granular Visualizations:** Interactive real-time charts showing personal and team trends, allowing team leaders to easily identify top performers or coaching opportunities.
* **Aggregated Dashboards:** Dynamic dashboard panels specialized for different roles, showing daily statistics and overall achievements at the Campaign, Pod, or Agent level.

### 2. Gamified Competitions
* **Custom Competitions:** Managers can run short-term (daily, weekly, or custom duration) competitions to drive focus toward specific high-impact KPIs.
* **Point Rules:** Competitions define score-based rules where different achievements award custom points.
* **Live Leaderboards:** Real-time dashboards featuring interactive tables, standings, and automated point summaries.
* **Badges & XP:** Agents earn experience points (XP) and badges for winning competitions, maintaining streaks, or achieving top milestones.

### 3. Team MS Teams Webhook Automation & Scoring
* **Inbound Hashtag Logging:** Agents or external bots can post simple hashtags (e.g., `#Smart`, `#Sale`) in Microsoft Teams channels to automatically log performance points into KPI Quest.
* **Outbound Live Broadcasts:** Celebrate victories by sending real-time beautiful Rich Cards or Adaptive Cards (featuring dynamic metrics and leaderboards) straight to Microsoft Teams channels.
* **Scheduled Postings:** Keep the entire department engaged with scheduled, automated updates showing daily progress, current standings, and target tracking.

### 4. Knowledge Management & Utilities
* **Modern Knowledge Base (KB):** Built-in collaborative article space featuring a powerful Rich Text Editor (Tiptap) with real-time category, subcategory, and tag classifications.
* **Interactive Shared Directory:** An internal organizational directory where team members can find contact details, filter by department or company, and search instantly.
* **Productivity Tools:** Dynamic calculators (for energy usage, instalment plans, tariff comparisons, etc.) and mini-games (like Rock Paper Scissors) to build culture and assist agents in daily duties.

---

## 📖 Glossary of Terms

To help you navigate the system, here are the key organizational units and entities within KPI Quest:

* **Campaign:** The highest organizational group. Represents a specific business line, department, or project (e.g., "Energy Sales", "Tech Support"). Core KPI rules and tracking goals are configured per Campaign.
* **Pod:** A subset of a Campaign. Represents a physical or virtual team of agents (e.g., "Phoenix Pod"). Every Pod can have its own dedicated Pod Manager and Team Leader.
* **User Roles:** Role-based system containing:
  * **Admin:** Unrestricted access to system configuration, backups, templates, webhooks, and raw database parameters.
  * **Campaign Manager:** Manages configuration specifically for their assigned Campaigns.
  * **Pod Manager / Team Leader:** Oversees performance tracking, logs, and agent participation in specific Pods.
  * **Competition Runner:** Has rights to create, modify, and start competitions.
  * **Agent:** Individual contributor who logs scores, participates in mini-games, and views personal performance charts.
* **KPI Rule:** Point-scoring logic defined within a competition. It specifies the points awarded, the associated emoji, and the daily targets.
* **Score Target:** A mapping configuration linking a specific hashtag (like `#Smart`) to a competition, enabling instant automated scoring.
