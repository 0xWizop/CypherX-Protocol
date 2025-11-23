/**
 * Create Banner Collection for Site-Wide Announcements
 * 
 * This script creates the banner collection in Firestore for displaying
 * site-wide announcements above the footer.
 * 
 * Usage:
 *   node scripts/create-banner-collection.js
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

async function createBannerCollection() {
  try {
    console.log('🚀 Starting banner collection creation...\n');
    
    // Initialize Firebase Admin
    const db = initFirebase();
    console.log('✅ Firebase Admin initialized\n');
    
    const bannerRef = db.collection('banner').doc('current');
    
    // Check if banner already exists
    const existingBanner = await bannerRef.get();
    
    if (existingBanner.exists) {
      console.log('⚠️  Banner already exists. Updating with new assets...\n');
    }
    
    // Initial banner data with AXB, VITASTEM, and MRDN assets
    const bannerData = {
      enabled: true,
      message: 'New assets added to our platform:',
      assets: [
        {
          name: 'AXB',
          symbol: 'AXB',
          poolAddress: '0x3B3B3DCFF8669297bEf410cDDCeA4c362074135A',
        },
        {
          name: 'VITASTEM',
          symbol: 'VITASTEM',
          poolAddress: '0x7Ae935b63e99382FB19Dc90c6ec30A2E6017eE23',
        },
        {
          name: 'MRDN',
          symbol: 'MRDN',
          poolAddress: '0x99d9b916F55883A88713287677B05A31E436E086',
        }
      ],
      backgroundColor: '#1e293b', // slate-800 to match theme
      textColor: '#f1f5f9', // slate-100
      linkColor: '#60a5fa', // blue-400
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await bannerRef.set(bannerData, { merge: true });
    
    console.log('✅ Banner collection created/updated successfully!\n');
    console.log('📝 Banner data:');
    console.log(JSON.stringify(bannerData, null, 2));
    console.log('\n✅ Banner is ready! It will appear above the footer on all pages.');
    console.log('   You can update the banner message, assets, or colors in Firebase Console:');
    console.log('   Collection: banner');
    console.log('   Document: current\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
createBannerCollection();

