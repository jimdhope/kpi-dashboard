// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // Keep connectAuthEmulator for dev
import { getFirestore, connectFirestoreEmulator, deleteField } from "firebase/firestore"; // Keep connectFirestoreEmulator
import { getStorage, connectStorageEmulator } from "firebase/storage"; // Keep connectStorageEmulator

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
  // Ensure NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is set, or handle its absence
  // Use empty string as fallback if undefined or null
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
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
   console.log("Firebase Initializing...");
} else {
  app = getApp();
   console.log("Firebase App Retrieved.");
}

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Storage
let analytics: any = null; // Initialize analytics as null

// Flag to ensure emulators are connected only once if needed
let emulatorsConnected = false;

// Connect to emulators only in development environment (client-side check)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && !emulatorsConnected) {
  // Check if running on localhost or a typical dev domain
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('local')) {
      console.log("Connecting to Firebase Emulators (Detected Dev Environment)...");
      try {
        // Make sure ports match your emulator setup
        connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectStorageEmulator(storage, 'localhost', 9199);
        console.log("Successfully connected to Firebase Emulators.");
        emulatorsConnected = true; // Set flag
      } catch (error) {
         console.error("Error connecting to Firebase Emulators:", error);
         // Fallback to production services might happen automatically if emulators aren't reachable
      }
  } else {
       console.log("Development environment detected, but not localhost. Using Production Firebase Services.");
  }

} else if (typeof window !== 'undefined') {
   console.log("Using Production Firebase Services.");
}


// Initialize Analytics (conditionally, only in browser and if supported/configured)
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    // Check if measurementId is defined and not an empty string before initializing
    const measurementId = firebaseConfig.measurementId;
    if (supported && measurementId && measurementId.trim() !== '') {
      try {
        analytics = getAnalytics(app);
        console.log("Firebase Analytics initialized with Measurement ID:", measurementId);
      } catch (error) {
         console.error("Error initializing Firebase Analytics:", error);
      }
    } else if (!measurementId || measurementId.trim() === '') {
        console.warn("Firebase Analytics not initialized: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is missing or empty in environment variables.");
    } else if (!supported) {
       console.log("Firebase Analytics not supported in this browser environment.");
    }
  }).catch(error => {
    console.error("Error checking Firebase Analytics support:", error);
  });
}


export { app, auth, db, storage, analytics, deleteField }; // Export storage and deleteField
