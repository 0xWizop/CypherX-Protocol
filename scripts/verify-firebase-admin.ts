/**
 * Firebase Admin SDK Verification Script
 * 
 * This script helps diagnose Firebase Admin SDK setup issues.
 * Run with: npx tsx scripts/verify-firebase-admin.ts
 */

import { adminDb, auth } from '../lib/firebase-admin';

async function verifyFirebaseAdmin() {
  console.log('🔍 Verifying Firebase Admin SDK Setup...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('  FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
  console.log('  FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
  console.log('  FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
  console.log('');

  // Check service account file
  try {
    const fs = require('fs');
    const path = require('path');
    const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
    const hasServiceAccountFile = fs.existsSync(serviceAccountPath);
    console.log('📄 Service Account File:');
    console.log('  Path:', serviceAccountPath);
    console.log('  Exists:', hasServiceAccountFile ? '✅ Yes' : '❌ No');
    if (hasServiceAccountFile) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        console.log('  Project ID:', serviceAccount.project_id || 'N/A');
        console.log('  Client Email:', serviceAccount.client_email || 'N/A');
      } catch (e) {
        console.log('  ⚠️  Could not parse service account file');
      }
    }
    console.log('');
  } catch (e) {
    console.log('  ⚠️  Could not check service account file');
    console.log('');
  }

  // Test Firebase Admin initialization
  console.log('🔧 Testing Firebase Admin Initialization...');
  try {
    const db = adminDb();
    console.log('  Database:', db ? '✅ Initialized' : '❌ Failed');
    
    if (db) {
      // Test a simple read operation
      console.log('  Testing database connection...');
      try {
        const testDoc = await db.collection('users').limit(1).get();
        console.log('  Read test:', testDoc ? '✅ Success' : '❌ Failed');
        console.log('  Documents found:', testDoc.size);
      } catch (readError: any) {
        console.log('  Read test:', '❌ Failed');
        console.log('  Error:', readError.message);
        
        // Check for permission errors
        if (readError.code === 7 || readError.message?.includes('PERMISSION_DENIED')) {
          console.log('\n⚠️  PERMISSION ERROR DETECTED!');
          console.log('This indicates an IAM permissions issue.');
          console.log('\n📝 To fix:');
          console.log('1. Go to Google Cloud Console → IAM & Admin → IAM');
          console.log('2. Find your service account (check client_email in firebaseServiceAccount.json)');
          console.log('3. Add the "Cloud Datastore User" role');
          console.log('4. Wait a few minutes for changes to propagate');
        }
      }
    }

    // Test Auth
    try {
      const authInstance = auth();
      console.log('  Auth:', authInstance ? '✅ Initialized' : '❌ Failed');
    } catch (authError: any) {
      console.log('  Auth:', '❌ Failed');
      console.log('  Error:', authError.message);
    }

  } catch (error: any) {
    console.log('  Initialization:', '❌ Failed');
    console.log('  Error:', error.message);
    console.log('\n⚠️  SETUP ISSUE DETECTED!');
    console.log('\n📝 Possible solutions:');
    console.log('1. Ensure firebaseServiceAccount.json exists in project root');
    console.log('2. Or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
    console.log('3. Check that the service account has proper IAM permissions');
  }

  console.log('\n✅ Verification complete!');
}

// Run verification
verifyFirebaseAdmin().catch(console.error);

