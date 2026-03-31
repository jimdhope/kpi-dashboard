# Admin & Management Guide - KPI Quest 2

This guide is for **Admin**, **Campaign Manager**, and **Pod Manager** roles. It covers how to manage users, pods, and campaigns within the application.

## 📊 Admin Dashboard

The Admin Dashboard provides a real-time overview of the entire system.

- **Latest Competition**: View today's Pod and Team standings for the currently active competition.
- **Tracker Leaderboard**: See the top 10 agents based on daily tracker achievements across all pods.
- **Pod Performance**: Monitor combined metrics (Achievements vs. Trackers) and agent counts per pod.
- **RPS Game Standings**: Track daily Rock-Paper-Scissors wins, losses, and draws at the team level.

## 🏆 Competition Management

Admins can manage the full lifecycle of competitions.

### 🥇 Competition Dashboard (`/competitions`)
- Filter standings by specific competitions and individual pods.
- View aggregate achievement summaries for every rule in the competition.
- Access detailed **Pod**, **Team**, and **Agent** leaderboards.

### ➕ Creating a Competition
1.  Navigate to **Competitions > Manage**.
2.  Use the **Competition Wizard** (`/competitions/manage/wizard`) for a step-by-step setup.
3.  Define the **Start/End Dates**, **Participating Pods**, and **Point Calculation Rules**.
4.  Add manual **Team Bonuses** or adjustments to reward specific milestones.

### ✍️ Logging Achievements (`/competitions/log`)
Admins and Managers are responsible for logging daily achievements for agents.
1.  Select the **Pod** and **Date**.
2.  Enter numeric values for each agent's KPIs (e.g., Sales, Calls).
3.  Use the **Presence Toggle** to mark agents as absent if necessary.
4.  **Send to Teams**: Click the button to broadcast the daily summary to the pod's configured Teams channel.

## 🎯 Tracker Management (`/trackers`)

Monitor and log daily rolling trackers.

### 🥇 Tracker Leaderboard
- View a comprehensive **Agent Leaderboard** filtered by date range (Today, This Week, This Month).
- See a breakdown of every tracker KPI per agent.

### ✍️ Logging Trackers (`/trackers/log`)
1.  Select one or more **Pods** and the **Date**.
2.  Enter values for each agent's rolling tracker KPIs.
3.  Changes are **auto-saved** as you type.
4.  **Send to Teams**: Broadcast the tracker results to Microsoft Teams.

## 📈 Performance Monitoring (`/performance`)

Deep-dive into KPI data with the Performance Dashboard.
- **Timeframe Filtering**: View data for This Week, This Month, Last 6 Weeks, or a Custom Range.
- **KPI-Specific Leaderboards**: See rankings for individual KPIs like "Sales," "Resolution Rate," etc.
- **Trend Analysis**: Identify top performers and pods across different metrics.

## 👥 User & Pod Management

### Users (`/settings/users`)
- Create and update user accounts.
- Assign multiple roles (Admin, Manager, Leader, Agent).
- Reset passwords and update profile details.

### Pods (`/settings/pods`)
- Create pods and link them to campaigns.
- Manage agent assignments to pods.
- **Teams Webhook**: Configure the webhook URL for automated Teams notifications.

### Pod Targets (`/settings/pod-targets`)
- Set specific daily numeric targets for each KPI within a pod.
