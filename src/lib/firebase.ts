
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // Removed connectAuthEmulator
import { getFirestore, deleteField } from "firebase/firestore"; // Removed connectFirestoreEmulator
import { getStorage } from "firebase/storage"; // Removed connectStorageEmulator

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
   console.log("Firebase Initialized (Production Mode)");
} else {
  app = getApp();
   console.log("Firebase App Retrieved (Production Mode)");
}

// Initialize services directly for production
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Storage
let analytics: any = null; // Initialize analytics as null

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
