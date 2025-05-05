
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // connectAuthEmulator added back for local dev
import { getFirestore, connectFirestoreEmulator, deleteField } from "firebase/firestore"; // connectFirestoreEmulator added back
import { getStorage, connectStorageEmulator } from "firebase/storage"; // connectStorageEmulator added back

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Ensure all these environment variables are set in your .env file
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Validate that essential config values are present
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error(
    "Firebase configuration error: Make sure NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID are set in your environment variables (.env file)."
  );
   // You might want to throw an error here or handle it appropriately
   // throw new Error("Firebase configuration is incomplete.");
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
   console.log("Firebase Initialized");
} else {
  app = getApp();
   console.log("Firebase App Retrieved");
}

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Storage
let analytics: any = null; // Initialize analytics as null

// Check if running in development environment (adjust condition if necessary)
// IMPORTANT: Make sure NEXT_PUBLIC_USE_EMULATORS is set to "true" in your .env.local for development
if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
    console.log("Connecting to Firebase Emulators...");
    try {
        // Connect Auth Emulator
        // Check if auth emulator is already connected to avoid errors on hot reload
        if (!auth.emulatorConfig) {
            connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
            console.log("Auth Emulator connected.");
        }

        // Connect Firestore Emulator
        // Check if firestore emulator is already connected
        // @ts-ignore // Ignore potential TS error for _settings Frozen check
        if (db.INTERNAL.settings.host !== 'localhost:8080') {
             connectFirestoreEmulator(db, 'localhost', 8080);
             console.log("Firestore Emulator connected.");
        }

        // Connect Storage Emulator
         // Check if storage emulator is already connected
         // @ts-ignore // Ignore potential TS error for emulatorConfig
         if (!storage.emulatorConfig) {
             connectStorageEmulator(storage, 'localhost', 9199);
             console.log("Storage Emulator connected.");
         }

    } catch (error) {
        console.error("Error connecting to Firebase Emulators:", error);
    }

} else {
    console.log("Connecting to Production Firebase Services.");
}

// Initialize Analytics (conditionally, only in browser and if supported/configured)
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) { // Also check if measurementId exists
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized");
    } else {
       console.log("Firebase Analytics not supported or measurementId missing.");
    }
  }).catch(error => {
    console.error("Error checking Firebase Analytics support:", error);
  });
}


export { app, auth, db, storage, analytics, deleteField }; // Export storage and deleteField

