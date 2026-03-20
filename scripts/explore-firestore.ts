/**
 * Firestore Database Exploration Script (Read-Only)
 * 
 * This script explores your Firestore database structure without making any changes.
 * 
 * Usage:
 *   npx ts-node scripts/explore-firestore.ts
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Initialize Firebase Admin SDK (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load service account, or use application default
let db: admin.firestore.Firestore;

async function initializeFirebase() {
  console.log('========================================');
  console.log('    Firestore Database Explorer       ');
  console.log('========================================\n');

  const serviceAccountPath = path.join(__dirname, 'service-account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    console.log('Using service account from scripts/service-account.json\n');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    db = admin.firestore();
  } else {
    console.log('No service account found, trying Application Default Credentials...\n');
    
    // Try to use ADC (Application Default Credentials)
    try {
      // This will work in environments with GOOGLE_APPLICATION_CREDENTIALS set
      // or if running in GCP, etc.
      if (!admin.apps || admin.apps.length === 0) {
        admin.initializeApp();
      }
      db = admin.firestore();
    } catch (error) {
      console.error('Failed to initialize Firebase:');
      console.error('Please either:');
      console.error('  1. Add service-account.json to scripts/ directory');
      console.error('  2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
      process.exit(1);
    }
  }
}

async function exploreFirestore() {
  await initializeFirebase();
  
  console.log('Fetching list of collections...\n');
  
  try {
    // List all top-level collections
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('No collections found in Firestore.\n');
      return;
    }
    
    console.log(`Found ${collections.length} collection(s):\n`);
    
    for (const collectionRef of collections) {
      const collectionName = collectionRef.id;
      console.log(`📁 Collection: ${collectionName}`);
      
      // Get a sample document to see structure
      const snapshot = await collectionRef.limit(1).get();
      
      if (snapshot.empty) {
        console.log(`   └─ (empty - no documents)`);
      } else {
        const sampleDoc = snapshot.docs[0];
        const docId = sampleDoc.id;
        const docData = sampleDoc.data();
        
        console.log(`   └─ Sample doc ID: ${docId}`);
        console.log(`   └─ Fields: ${Object.keys(docData).join(', ') || '(none)'}`);
        
        // Check for subcollections
        const subcollections = await sampleDoc.ref.listCollections();
        if (subcollections.length > 0) {
          console.log(`   └─ Subcollections: ${subcollections.map(s => s.id).join(', ')}`);
          
          // Explore subcollections
          for (const subCol of subcollections) {
            const subSnapshot = await subCol.limit(2).get();
            console.log(`      └─ 📁 ${subCol.id}: ${subSnapshot.size} docs (showing 2 samples)`);
            
            if (!subSnapshot.empty) {
              for (const subDoc of subSnapshot.docs) {
                const subFields = Object.keys(subDoc.data());
                console.log(`         └─ ${subDoc.id}: ${subFields.join(', ')}`);
              }
            }
          }
        }
      }
      console.log('');
    }
    
    // Specifically check for 'users' collection
    console.log('========================================');
    console.log('    Detailed Users Collection Check    ');
    console.log('========================================\n');
    
    try {
      const usersRef = db.collection('users');
      const usersSnapshot = await usersRef.limit(3).get();
      
      console.log(`Users collection: ${usersSnapshot.size} sample(s) found\n`);
      
      for (const userDoc of usersSnapshot.docs) {
        console.log(`👤 User: ${userDoc.id}`);
        const userData = userDoc.data();
        
        // Show common user fields
        const commonFields = ['email', 'displayName', 'name', 'firstName', 'lastName', 'role', 'podId', 'uid'];
        const foundFields = commonFields.filter(f => f in userData);
        if (foundFields.length > 0) {
          console.log(`   └─ Identifiers: ${foundFields.map(f => `${f}: ${userData[f]}`).join(', ')}`);
        }
        console.log(`   └─ All fields: ${Object.keys(userData).join(', ')}`);
        
        // List subcollections
        const subcollections = await userDoc.ref.listCollections();
        if (subcollections.length > 0) {
          console.log(`   └─ Subcollections:`);
          for (const subCol of subcollections) {
            const count = await subCol.count().get();
            console.log(`      └─ 📁 ${subCol.id}: ${count.data().count} docs`);
          }
        } else {
          console.log(`   └─ No subcollections`);
        }
        console.log('');
      }
    } catch (error: any) {
      console.log(`Users collection not found or access denied.`);
      console.log(`Error: ${error.message}`);
    }
    
    console.log('========================================');
    console.log('         Exploration Complete          ');
    console.log('========================================\n');
    console.log('Use this information to update the migration script.\n');
    
  } catch (error: any) {
    console.error('Error exploring Firestore:');
    console.error(error.message);
    console.error('\nMake sure you have:');
    console.error('  1. Valid Firebase credentials');
    console.error('  2. Read permissions on Firestore');
  }
}

// Run the exploration
exploreFirestore()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
