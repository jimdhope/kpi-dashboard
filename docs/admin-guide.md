# Administrator & Configuration Guide

Welcome to the **KPI Quest Administrator and Configuration Guide**. This document is designed for system administrators, operations managers, and directors responsible for configuring, maintaining, and managing the KPI Quest platform.

---

## 👥 User & Role Management

KPI Quest has a robust **Role-Based Access Control (RBAC)** system. Roles determine dashboard accessibility and action permissions.

### Admin-Only Controls (`/settings/users`)
1. **Adding Users:**
   - Go to **Settings → Users**.
   - Input the user's name, primary email, and an initial temporary password.
   - Assign appropriate organizational roles.
2. **Assigning Roles:**
   - Users can hold multiple roles simultaneously depending on operational needs:
     - **Admin:** Absolute system ownership.
     - **Campaign Manager:** Full settings control restricted to their assigned Campaigns.
     - **Pod Manager:** Responsible for editing membership and logs for specific pods.
     - **Team Leader:** Standard leader of a Pod; reviews logs and coaches agents.
     - **Competition Runner:** Can draft and run competitions.
     - **Agent:** Direct contributor; logs performance and views personal targets.
3. **Password Management:**
   - When creating a user or resetting their password, you can toggle **"Must Change Password on Next Login"**. This forces them to a password reset page before they can access dashboards.
   - In emergencies, admins can trigger password resets directly or use the administrative command-line reset script:
     ```bash
     npx tsx scripts/reset-passwords.ts
     ```

---

## 🏢 Campaign & Pod Architecture

KPI Quest organizes participants hierarchically. Getting this structure right is crucial for correct dashboard reports and targeting.

```
       ┌─────────────────────────────────────────┐
       │                CAMPAIGN                 │
       │        (e.g., Utility Sales)            │
       └────────────────────┬────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│          POD          │       │          POD          │
│     (Phoenix Team)    │       │     (Viking Team)     │
└───────────┬───────────┘       └───────────┬───────────┘
            │                               │
    ┌───────┴───────┐               ┌───────┴───────┐
    ▼               ▼               ▼               ▼
┌───────┐       ┌───────┐       ┌───────┐       ┌───────┐
│ Agent │       │ Agent │       │ Agent │       │ Agent │
└───────┘       └───────┘       └───────┘       └───────┘
```

### Campaigns (`/settings/campaigns`)
* **Represent lines of business** (e.g., "Outbound Gas", "General Customer Care").
* Competitions and performance trackers are bound to specific Campaigns.
* You can toggle Campaigns active or inactive. Deactivating a Campaign hides it from general selection but preserves historical records.

### Pods (`/settings/pods`)
* **Represent actual teams of agents** within a Campaign.
* To create a Pod, specify:
  1. **Name & Description**.
  2. **Associated Campaign**.
  3. **Pod Manager & Team Leader** (assigned from available users).
* Manage memberships by clicking **Edit Members** on a Pod card. Add or remove agents dynamically.

---

## 🎯 Daily Targets & Effective Targets

When configuring competition rules (`/competitions/manage`), you can specify a **Daily Target** for rules (e.g., 5 daily sales per agent).

The system calculates an **Effective Target** to display on reports and dashboards to provide realistic milestones:
$$\text{Effective Target} = \text{Daily Target} \times \text{Active Days in Period} \times \text{Number of Active Agents}$$

* **Active Days:** Represents the number of days the competition runs (excluding scheduled rest days if configured).
* **Active Agents:** The count of unique agents registered within the Pods participating in the competition.
* This ensures that aggregate charts on the Reports page show target lines adjusted to actual team scale and timeframes, rather than single-day individual targets.

---

## 💬 MS Teams Webhooks & Automations

KPI Quest supports deep integration with Microsoft Teams, facilitating automated updates and hashtag-based scoring.

### 1. Webhook Endpoints Configuration (`/settings/teams-webhooks`)
You can register two types of webhook endpoints:
- **Inbound Webhook (Incoming to KPI Quest):** Accepts incoming HTTP POST payloads from Teams (or external workflows). Used for hashtag scoring.
- **Outbound Webhook (Outgoing to Teams):** An Office 365 Connector URL or Workflow Webhook URL. Used to publish achievements and leaderboards.

Each endpoint can be categorized by purpose: `daily_summary`, `leaderboard`, `alert`, `campaign`, or `custom`.

### 2. Teams Message Templates (`/settings/teams`)
Templates define what the Teams posts look like. You can write templates in three formats:
- **Message Cards:** Legacy Office 365 connector format. Simple, Markdown-compatible.
- **Adaptive Cards:** Rich interactive layout format. JSON structured.
- **Adaptive Cards with Image:** Generates an Adaptive Card embedded with a dynamic PNG image. KPI Quest renders these images on-the-fly using `@resvg/resvg-js` to showcase visually stunning leaderboard bar charts directly in the Teams chat!

You can use merge tags in templates, such as:
- `${agentName}` / `${score}`
- `${competitionName}`
- `${standingsList}`

### 3. Teams Automations (`/settings/teams-automations`)
Automations link events to outbound webhooks.
* **Triggers:**
  - `incomingWebhookReceived`: Triggered when an external service hits an inbound endpoint.
  - `performanceLogged`: Triggered when an agent submits daily tracker statistics.
  - `competitionScoreLogged`: Triggered when points are logged inside a competition.
* **Batching and Windows:**
  - To prevent chat spam, you can set a **Batch Window** (e.g., 5 minutes) which accumulates scores and sends a unified summary.
  - Set a **Cooldown Period** to enforce a minimum sleep time between consecutive triggers.
  - Set **Quiet Hours** to queue deliveries during off-hours, sending them automatically when quiet hours end.

---

## 🏷️ Webhook Hashtag Scoring (`/settings/score-targets`)

Agents can log scores without opening the web app by typing registered hashtags in a Microsoft Teams channel connected to KPI Quest's Inbound Webhook.

### How to Configure Score Targets:
1. Go to **Settings → Score Targets**.
2. Click **Create Score Target**.
3. Define the configuration:
   - **Hashtag:** The trigger word (e.g., `#Smart`, `#Sale`).
   - **Name:** Friendly identifier.
   - **Target Type:** Specify whether this logs to a **Competition Rule** or an ongoing **Performance Tracker**.
   - **Target ID:** Select the target competition rule or tracker KPI.
   - **Default Points:** Specify how many points this hashtag logs per occurrence (e.g., `#Smart` = 1 point, `#GrandSlam` = 5 points).
4. Ensure your Teams channel webhook or bot is configured to forward messages containing these hashtags to KPI Quest's inbound endpoint.

---

## 💾 Backup, Restore, & Data Cleansing (`/settings/general`)

For compliance, server migration, or staging setup, administrators have complete control over system database operations.

### Backup & Export
* Go to **Settings → General** (under administrative options).
* Click **Create Backup**.
* The system compiles all database records (User mappings, Campaigns, Pods, Competitions, Rules, logs, KB articles, directory records, automations) into a compressed JSON structure and triggers a browser download.

### Restore & Import
* Select a valid KPI Quest backup JSON file in the upload field.
* Click **Restore from Backup**.
* *Warning:* This operation will replace or update current records based on ID matching. We recommend reviewing database logs before completing a restore.

### Clear Database (Cleansing)
* In staging environments or at the start of a fresh annual campaign, you can click **Clear All Data**.
* This resets the databases completely, leaving only the primary seed administrator account so you can build out fresh structural campaigns.

---

## 🛠️ Troubleshooting & Diagnostics

If MS Teams notifications or updates are failing to deliver:
1. **Verify Endpoint Status:**
   - Go to **Settings → Teams Webhooks**.
   - Click the **Test Webhook** button on your outbound endpoint.
   - The system sends a generic test payload and updates the endpoint's status to `success` or `failed` with raw HTTP status codes.
2. **Review Background Logs:**
   - Ensure the KPI Quest background job worker is active. The system depends on a `pg-boss` queue running in the background to send scheduled card notifications.
   - If running natively, check systemd logs:
     ```bash
     sudo journalctl -u kpi-dashboard -f
     ```
3. **Verify Database Connections:**
   - If Prisma Client errors occur, check the `DATABASE_URL` environment variable inside your `.env.local` file. Ensure PostgreSQL is active:
     ```bash
     sudo systemctl status postgresql
     ```
