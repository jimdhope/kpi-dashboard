# KPI Quest

KPI Quest is a comprehensive gamification platform designed to boost team engagement and productivity. It combines KPI tracking, friendly competitions, and team activities to create an motivating work environment.

## Features

- **Competitions** - Create and manage KPI competitions with custom rules, team challenges, and achievement logging
- **Leaderboards** - Real-time rankings for individuals, teams, and pods
- **Trackers** - Campaign-wide tracking and monitoring with daily targets
- **Performance Analytics** - Comprehensive KPI breakdowns with exportable reports
- **Mini Games** - Fun team activities like Rock-Paper-Scissors
- **Role-Based Access** - Tailored experiences for Admin, Campaign Manager, Pod Manager, Team Leader, Competition Runner, and Agent roles

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18 + Tailwind CSS + shadcn/ui
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Rich Text:** Lexical Editor
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase project with Firestore and Authentication enabled

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:9002

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |

## Project Structure

```
src/
├── app/               # Next.js App Router pages
│   ├── (admin)/      # Admin dashboard routes
│   ├── (agent)/      # Agent dashboard routes
│   ├── (app)/         # Main app routes
│   ├── (auth)/        # Authentication routes
│   └── (public)/       # Public pages
├── components/         # React components
│   └── ui/           # shadcn/ui components
├── hooks/            # Custom React hooks
├── lib/              # Utilities and Firebase config
├── models/           # TypeScript types
└── services/        # Business logic services
```

## User Roles

| Role | Description |
|------|-------------|
| Admin | Full access to all features and settings |
| Campaign Manager | Full access to all features |
| Pod Manager | Full access to all features |
| Team Leader | Admin access for Competitions and Trackers |
| Competition Runner | Admin access for Competitions only |
| Agent | Access to personal dashboard and agent-facing features |

## Planned Features

- Knowledge Base / Wiki for team resources
- Contact Book for agent directories
- Useful Tools for daily agent workflows

## License

MIT
