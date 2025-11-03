/**
 * Create Collections and Indexes for Orders, Positions, and Wallet Tracking
 * 
 * This script creates the necessary Firestore collections and indexes for:
 * - wallet_orders: Trading orders
 * - wallet_positions: Open positions
 * - wallet_transactions: Transaction history
 * - user_wallet_data: User wallet linkage and tracking
 * 
 * Usage:
 *   node scripts/create-collections-and-indexes.js
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

// Index definitions for Firestore
const INDEXES_TO_CREATE = [
  // wallet_orders indexes
  {
    collectionId: 'wallet_orders',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'wallet_orders',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'wallet_orders',
    fields: [
      { fieldPath: 'tokenAddress', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // wallet_positions indexes
  {
    collectionId: 'wallet_positions',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'tokenAddress', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'wallet_positions',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'isOpen', order: 'ASCENDING' },
      { fieldPath: 'openedAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // wallet_transactions indexes
  {
    collectionId: 'wallet_transactions',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'wallet_transactions',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'wallet_transactions',
    fields: [
      { fieldPath: 'outputToken', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'wallet_transactions',
    fields: [
      { fieldPath: 'walletAddress', order: 'DESCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // user_wallet_data indexes
  {
    collectionId: 'user_wallet_data',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'linkedAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'user_wallet_data',
    fields: [
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'isVerified', order: 'ASCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'user_wallet_data',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'isPrimary', order: 'ASCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  
  // user_activities indexes (update existing)
  {
    collectionId: 'user_activities',
    fields: [
      { fieldPath: 'action', order: 'ASCENDING' },
      { fieldPath: 'indexName', order: 'ASCENDING' },
      { fieldPath: 'walletAddress', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  },
  {
    collectionId: 'user_activities',
    fields: [
      { fieldPath: 'walletAddress', order: 'DESCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ],
    queryScope: 'COLLECTION'
  }
];

// Create sample documents to establish collection structure
async function createSampleDocuments(db) {
  console.log('\n📝 Creating sample documents to establish collections...\n');
  
  const collections = [
    {
      name: 'wallet_orders',
      sample: {
        walletAddress: '0x0000000000000000000000000000000000000000',
        tokenAddress: '0x0000000000000000000000000000000000000000',
        type: 'BUY',
        status: 'PENDING',
        amount: '0',
        price: '0',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    },
    {
      name: 'wallet_positions',
      sample: {
        walletAddress: '0x0000000000000000000000000000000000000000',
        tokenAddress: '0x0000000000000000000000000000000000000000',
        amount: '0',
        entryPrice: '0',
        currentPrice: '0',
        isOpen: true,
        openedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    },
    {
      name: 'user_wallet_data',
      sample: {
        userId: 'sample_user_id',
        walletAddress: '0x0000000000000000000000000000000000000000',
        isPrimary: false,
        isVerified: false,
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {}
      }
    }
  ];
  
  for (const { name, sample } of collections) {
    try {
      const docRef = db.collection(name).doc('_sample');
      const exists = (await docRef.get()).exists;
      
      if (!exists) {
        await docRef.set(sample);
        console.log(`   ✅ Created sample document in ${name}`);
      } else {
        console.log(`   ℹ️  Sample document already exists in ${name}`);
      }
    } catch (error) {
      console.error(`   ❌ Error creating sample in ${name}:`, error.message);
    }
  }
}

// Note: Firestore index creation must be done via Firebase Console or CLI
// This script outputs the indexes that need to be created
function printIndexesToCreate() {
  console.log('\n📋 Indexes to create (copy these to Firebase Console or firebase.json):\n');
  
  INDEXES_TO_CREATE.forEach((index, i) => {
    console.log(`${i + 1}. Collection: ${index.collectionId}`);
    console.log(`   Fields:`);
    index.fields.forEach(field => {
      console.log(`     - ${field.fieldPath} (${field.order})`);
    });
    console.log(`   Query Scope: ${index.queryScope}\n`);
  });
  
  console.log('\n📝 To create indexes:');
  console.log('   1. Go to: https://console.firebase.google.com/project/homebase-dapp/firestore/indexes');
  console.log('   2. Click "Add index"');
  console.log('   3. Enter the collection and fields from above');
  console.log('   OR use Firebase CLI: firebase deploy --only firestore:indexes\n');
}

async function createCollectionsAndIndexes() {
  try {
    console.log('🚀 Starting creation of collections and indexes...\n');
    
    // Initialize Firebase Admin
    const db = initFirebase();
    console.log('✅ Firebase Admin initialized\n');
    
    // Create sample documents to establish collections
    await createSampleDocuments(db);
    
    // Print indexes that need to be created
    printIndexesToCreate();
    
    console.log('✅ Collections established!');
    console.log('📝 Next step: Create the indexes manually via Firebase Console');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
createCollectionsAndIndexes().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

