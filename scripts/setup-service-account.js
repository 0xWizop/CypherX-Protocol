/**
 * Setup Firebase Service Account
 * 
 * IMPORTANT: This script creates firebaseServiceAccount.json from environment variables.
 * DO NOT commit the service account file to git!
 * 
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/setup-service-account.js
 * 
 * Or create a .env file with:
 *   FIREBASE_SERVICE_ACCOUNT='{...}'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountEnv && !serviceAccountJson) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required');
  console.log('\n📝 Usage:');
  console.log('  Option 1: Set FIREBASE_SERVICE_ACCOUNT as JSON string');
  console.log('  Option 2: Set FIREBASE_SERVICE_ACCOUNT_JSON as JSON string');
  console.log('  Option 3: Add to .env file');
  process.exit(1);
}

let serviceAccount;

try {
  // Try parsing from FIREBASE_SERVICE_ACCOUNT_JSON first, then FIREBASE_SERVICE_ACCOUNT
  const jsonString = serviceAccountJson || serviceAccountEnv;
  serviceAccount = JSON.parse(jsonString);
} catch (error) {
  console.error('❌ Error: Invalid JSON in service account environment variable');
  console.error(error.message);
  process.exit(1);
}

// Validate required fields
const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
const missingFields = requiredFields.filter(field => !serviceAccount[field]);

if (missingFields.length > 0) {
  console.error(`❌ Error: Missing required fields: ${missingFields.join(', ')}`);
  process.exit(1);
}

// Write to firebaseServiceAccount.json
const outputPath = path.join(__dirname, '..', 'firebaseServiceAccount.json');

try {
  fs.writeFileSync(outputPath, JSON.stringify(serviceAccount, null, 2));
  console.log('✅ Service account saved to:', outputPath);
  console.log(`✅ Project ID: ${serviceAccount.project_id}`);
  console.log(`✅ Client Email: ${serviceAccount.client_email}`);
  console.log('\n⚠️  WARNING: Do NOT commit firebaseServiceAccount.json to git!');
  console.log('⚠️  Add it to .gitignore if not already added.');
} catch (error) {
  console.error('❌ Error writing service account file:', error.message);
  process.exit(1);
}






