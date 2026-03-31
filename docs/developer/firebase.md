# Firebase Configuration & Schema - KPI Quest 2

This document details the Firebase configuration, Firestore database schema, and security rules for the KPI Quest 2 project.

## 🔥 Firebase Services

The project uses the following Firebase services:
- **Authentication**: Email/Password-based auth.
- **Cloud Firestore**: Real-time NoSQL database.
- **Firebase Hosting**: High-speed CDN for static assets and Next.js integration.
- **Firebase Emulators**: Local development environment (optional).

## 🏗 Firestore Schema

The application uses a flat collection structure for simplicity and real-time synchronization.

### 1. `users`
- **Document ID**: Auth `uid`
- **Fields**:
  - `uid`: string (Firebase Auth UID)
  - `name`: string
  - `email`: string
  - `roles`: string[] (e.g., `['admin', 'agent']`)
  - `podId`: string | null (ID of the assigned pod)
  - `avatarUrl`: string (Optional)

### 2. `campaigns`
- **Fields**:
  - `name`: string
  - `description`: string
  - `rules`: Rule[] (Embedded array of rules)

### 3. `pods`
- **Fields**:
  - `name`: string
  - `campaignId`: string
  - `members`: string[] (Array of user UIDs)

### 4. `competitions`
- **Fields**:
  - `name`: string
  - `startDate`: Timestamp
  - `endDate`: Timestamp
  - `rules`: Rule[]
  - `podIds`: string[] (Pods participating)

### 5. `dailyAchievements`
- **Fields**:
  - `userId`: string
  - `date`: Timestamp
  - `kpiId`: string
  - `value`: number

### 6. `dailyPodTargets`
- **Fields**:
  - `podId`: string
  - `date`: string (YYYY-MM-DD)
  - `targets`: Record<string, number>

### 7. `dailyTaskLogs`
- **Fields**:
  - `userId`: string
  - `date`: string (YYYY-MM-DD)
  - `tasks`: string[]

### 8. `teamBonusLogs`
- **Fields**:
  - `teamId`: string
  - `date`: string (YYYY-MM-DD)
  - `bonusAmount`: number

### 9. `rpsGames` (Rock-Paper-Scissors)
- **Fields**:
  - `players`: string[]
  - `results`: Record<string, string>
  - `timestamp`: Timestamp

## 🛡 Security Rules

Security rules are managed in `firestore.rules`. The current strategy is:
- **Default**: Deny all reads and writes.
- **Authenticated Access**: Most collections require the user to be authenticated (`request.auth != null`).
- **User Records**: Users can read and update their own document.
- **Lookup Access**: All authenticated users can read basic user info (for leaderboards and selection lists).

> **Warning**: While authenticated users can currently read/write many collections, production rules should be tightened to restrict write access based on the `roles` field in the user's document.

## 🛠 Local Development (Emulators)

To use the Firebase emulators, set `NEXT_PUBLIC_USE_EMULATORS=true` in your `.env.local`.

1. **Install Firebase CLI**: `npm install -g firebase-tools`
2. **Login**: `firebase login`
3. **Start Emulators**: `firebase emulators:start`

The emulators will be available at:
- **Auth**: [http://localhost:9099](http://localhost:9099)
- **Firestore**: [http://localhost:8080](http://localhost:8080)
- **Emulator Suite UI**: [http://localhost:4000](http://localhost:4000)
