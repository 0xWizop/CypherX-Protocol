/**
 * Check which Firebase service account is being used
 * Run with: npx tsx scripts/check-service-account.ts
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Checking Firebase Service Account Configuration...\n');

// Check service account file
const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('📄 Service Account File Found:');
    console.log('  Path:', serviceAccountPath);
    console.log('  Project ID:', serviceAccount.project_id);
    console.log('  Client Email:', serviceAccount.client_email);
    console.log('  Type:', serviceAccount.type);
    console.log('\n⚠️  IMPORTANT: Make sure you added "Cloud Datastore User" role to THIS email:');
    console.log(`   ${serviceAccount.client_email}`);
    console.log('\n📝 Steps to verify:');
    console.log('1. Go to Google Cloud Console → IAM & Admin → IAM');
    console.log(`2. Search for: ${serviceAccount.client_email}`);
    console.log('3. Verify it has "Cloud Datastore User" role');
    console.log('4. If not, click Edit and add it');
  } catch (error) {
    console.error('❌ Error reading service account file:', error);
  }
} else {
  console.log('❌ Service account file not found at:', serviceAccountPath);
  console.log('\n📝 Checking environment variables...');
  console.log('  FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || '❌ Missing');
  console.log('  FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL || '❌ Missing');
  console.log('  FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
  
  if (process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('\n⚠️  IMPORTANT: Make sure you added "Cloud Datastore User" role to THIS email:');
    console.log(`   ${process.env.FIREBASE_CLIENT_EMAIL}`);
  }
}

console.log('\n✅ Check complete!');




