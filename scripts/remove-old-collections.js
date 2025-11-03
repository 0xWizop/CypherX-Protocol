/**
 * Remove Old Collections and Indexes
 * 
 * This script removes old/unused collections and indexes from Firestore.
 * Run with caution - it will delete data!
 * 
 * Usage:
 *   node scripts/remove-old-collections.js
 * 
 * Collections to remove:
 *   - test (test collection)
 *   - submitListing (if deprecated)
 * 
 * WARNING: This script will DELETE data. Make sure you have backups!
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // Try service account file first
  const serviceAccountPath = path.join(__dirname, '..', 'firebaseServiceAccount.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    return admin.firestore();
  }

  // Try environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const normalizePrivateKey = (key) => key.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      }),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    return admin.firestore();
  }

  throw new Error('Firebase Admin initialization failed. Please ensure firebaseServiceAccount.json exists or set environment variables.');
}

// Collections to remove (be VERY careful here!)
const COLLECTIONS_TO_REMOVE = [
  'test', // Test collection - remove if no longer needed
  // Add other collections to remove here
];

// Index IDs to remove (if you know specific index IDs)
const INDEXES_TO_REMOVE = [
  // Add specific index IDs here if needed
  // Note: Index removal must be done via Firebase Console or CLI
];

async function deleteCollection(db, collectionPath) {
  console.log(`\n🗑️  Deleting collection: ${collectionPath}`);
  
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    console.log(`   ℹ️  Collection ${collectionPath} is already empty`);
    return;
  }
  
  console.log(`   📊 Found ${snapshot.size} documents`);
  
  let deletedCount = 0;
  const batch = db.batch();
  let batchCount = 0;
  
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    batchCount++;
    deletedCount++;
    
    // Firestore batches are limited to 500 operations
    if (batchCount >= 500) {
      await batch.commit();
      console.log(`   ✅ Deleted batch (${deletedCount}/${snapshot.size} documents)`);
      batchCount = 0;
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`   ✅ Deleted ${deletedCount} documents from ${collectionPath}`);
}

async function removeOldCollections() {
  try {
    console.log('🚀 Starting removal of old collections...\n');
    
    // Initialize Firebase Admin
    const db = initFirebase();
    console.log('✅ Firebase Admin initialized\n');
    
    // Confirm deletion
    console.log('⚠️  WARNING: This will DELETE the following collections:');
    COLLECTIONS_TO_REMOVE.forEach(col => console.log(`   - ${col}`));
    console.log('\n⚠️  Make sure you have backups!');
    
    // In production, you might want to add a confirmation prompt
    // For now, we'll proceed with the deletion
    
    // Delete collections
    for (const collectionName of COLLECTIONS_TO_REMOVE) {
      try {
        await deleteCollection(db, collectionName);
      } catch (error) {
        console.error(`❌ Error deleting collection ${collectionName}:`, error.message);
      }
    }
    
    console.log('\n✅ Old collections removal completed!');
    console.log('\n📝 Note: Index removal must be done via Firebase Console:');
    console.log('   https://console.firebase.google.com/project/homebase-dapp/firestore/indexes');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
removeOldCollections().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

