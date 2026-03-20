# KPI Quest 2

> A comprehensive gamification platform for boosting team engagement and productivity through KPI tracking, friendly competitions, and real-time performance analytics.

[![Framework: Next.js 14](https://img.shields.io/badge/Framework-Next.js%2014-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![UI: Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Database: Firebase](https://img.shields.io/badge/Database-Firebase-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

## Why KPI Quest?

Maintaining high productivity and engagement in a performance-driven environment is challenging. KPI Quest solves this by transforming standard KPI monitoring into an interactive experience. By introducing competitions, leaderboards, and real-time feedback, it creates a motivating environment while minimizing the overhead of manual tracking.

## Core Features

- **🏆 Competitions** - Create time-bound challenges with custom rules, points, and team-based goals.
- **📊 Real-time Leaderboards** - Instantly see where you or your team stand at the Pod, Team, or Individual level.
- **📈 Advanced Trackers** - Monitor campaign-wide progress with granular daily targets and automated updates.
- **🎯 Performance Analytics** - Deep-dive into KPI breakdowns with exportable data for performance reviews.
- **🎮 Mini Games** - Integrated activities like Rock-Paper-Scissors to foster team spirit and break the routine.
- **🔒 Role-Based Access Control** - Granular permissions ensuring everyone sees only what they need to.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend-as-a-Service**: Firebase (Firestore, Authentication, Storage, Analytics)
- **Rich Text**: Lexical Editor for competition rules
- **Charts**: Recharts for performance visualization

## Getting Started

### Prerequisites

- **Node.js**: 20.0.0 or higher
- **Firebase Project**: A project set up at [Firebase Console](https://console.firebase.google.com/) with Firestore and Auth enabled.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/kpi-quest-2.git
   cd kpi-quest-2
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_id
   # Optional: Set to 'true' to use Firebase Emulators locally
   NEXT_PUBLIC_USE_EMULATORS=false
   ```

4. **Run for development**:
   ```bash
   npm run dev
   ```
   Access the application at [http://localhost:9002](http://localhost:9002).

## Documentation

- [Architecture Overview](docs/developer/architecture.md)
- [RBAC & User Roles](docs/developer/rbac.md)
- [Admin & Management Guide](docs/tutorials/admin-guide.md)
- [Agent Guide & Tutorials](docs/tutorials/agent-guide.md)

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
