// This file contains the configuration object needed to connect your native
// desktop applications (Windows, macOS) or any other client to your Firebase project.

// How to use this:
// 1. Install the Firebase SDK in your native application project.
//    - For most desktop apps (Electron, .NET, etc.), you'll use the Web SDK (`firebase`).
//    - See the guide at /guides/native-app-guide for more details and links.
// 2. Copy the firebaseConfig object below into your native application's code.
// 3. Use it to initialize the Firebase app: `initializeApp(firebaseConfig);`

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
