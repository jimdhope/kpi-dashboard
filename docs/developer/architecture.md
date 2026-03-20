# Architecture Overview - KPI Quest 2

This document provides a high-level overview of the KPI Quest 2 system architecture, tech stack, and core design principles.

## 🏛 System Design

KPI Quest 2 is built as a **Single Page Application (SPA)** using **Next.js 14** with the **App Router** for routing and state management. The backend is powered by **Firebase**, providing real-time data synchronization through Firestore and seamless user authentication.

### Core Architecture Components

1. **Frontend (Next.js)**:
   - **App Router**: Handles routing, server components, and layout management.
   - **Client Components**: Used for interactive features like dashboards, forms, and mini-games.
   - **State Management**: Primarily relies on React hooks (`useState`, `useEffect`) and real-time Firestore listeners (`onSnapshot`) to keep the UI in sync with the database.
   - **Tailwind CSS**: Provides a responsive, clean, and modern UI.

2. **Backend (Firebase)**:
   - **Authentication**: Handles user sign-up, login, and session management.
   - **Firestore (NoSQL Database)**: Stores all persistent data (users, competitions, achievements, etc.).
   - **Storage**: (Planned) Used for profile pictures and competition media.
   - **Hosting**: Deployed via **Firebase App Hosting** for a fast, global CDN.

3. **External Integrations**:
   - **Microsoft Teams Webhooks**: Integrated via Next.js Server Actions (`src/services/teamsWebhook.ts`) to send real-time achievement summaries and daily scores to Teams channels using Adaptive Cards.

## 📁 Directory Structure

```text
src/
├── app/               # Next.js App Router pages and layouts
│   ├── (admin)/      # Admin dashboard and user management
│   ├── (agent)/      # Agent-facing features (competitions, profile)
│   ├── (app)/         # Shared application logic (trackers, performance)
│   ├── (auth)/        # Auth flow (login, forgot-password)
│   └── (public)/       # Public guides and documentation
├── components/         # Reusable React components
│   ├── ui/           # Basic shadcn/ui primitives
│   └── ...           # Project-specific complex components
├── hooks/            # Custom React hooks (e.g., useToast, useMobile)
├── lib/              # Utility functions and Firebase initialization
├── models/           # TypeScript interfaces and global types
└── services/        # Business logic and database interaction services
```

## 🔄 Data Flow & State Management

KPI Quest 2 uses a hybrid approach for data interaction:

- **Direct Firestore Access**: Many client components interact directly with Firestore using the Firebase Web SDK for real-time updates (`onSnapshot`).
- **Server Actions**: Specialized services (like Teams Webhook notifications) are implemented as Server Actions (`'use server'`) to securely handle external API calls and sensitive logic.
- **Data Migration**: Utility scripts (`scripts/migrate-daily-targets.ts`) are used to manage schema evolutions, such as transitioning from day-of-week targets to simplified daily numeric targets.

## 🛡 Security & Permissions

Security is enforced at two levels:
1. **Frontend Routing**: Layout-level checks verify the user's role before granting access to specific sections (e.g., `/admin`).
2. **Firestore Rules**: Security rules in `firestore.rules` ensure that users can only read/write data they are authorized to access, protecting sensitive KPI and user data.

For more details on roles, see [RBAC & User Roles](rbac.md).

## 📊 Core V2 Features

- **Daily Pod Targets**: Simplified daily target tracking for pods, allowing managers to set specific goals per KPI.
- **Team Bonuses & Adjustments**: System for adding manual adjustments or bonuses to team scores during competitions.
- **Adaptive Card Notifications**: Rich notifications sent to Microsoft Teams with agent leaderboards and pod target progress.
