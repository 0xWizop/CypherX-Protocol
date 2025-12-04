import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';

/**
 * Test endpoint to diagnose Firebase Admin SDK issues
 * Access at: /api/test/firebase-admin
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    tests: {},
    errors: [],
    success: false
  };

  try {
    // Test 1: Firebase Admin Initialization
    diagnostics.tests.initialization = { status: 'testing' };
    let db;
    try {
      db = adminDb();
      diagnostics.tests.initialization = {
        status: 'success',
        message: 'Firebase Admin initialized successfully'
      };
    } catch (error: any) {
      diagnostics.tests.initialization = {
        status: 'failed',
        error: error.message,
        stack: error.stack
      };
      diagnostics.errors.push(`Initialization failed: ${error.message}`);
      return NextResponse.json(diagnostics, { status: 500 });
    }

    // Test 2: Get Service Account Info
    try {
      const fs = require('fs');
      const path = require('path');
      const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        diagnostics.tests.serviceAccount = {
          status: 'found',
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          type: serviceAccount.type
        };
      } else {
        diagnostics.tests.serviceAccount = {
          status: 'not_found',
          message: 'Using environment variables',
          projectId: process.env.FIREBASE_PROJECT_ID || 'not set',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'not set'
        };
      }
    } catch (error: any) {
      diagnostics.tests.serviceAccount = {
        status: 'error',
        error: error.message
      };
    }

    // Test 3: Firestore Read Permission
    diagnostics.tests.firestoreRead = { status: 'testing' };
    try {
      const testQuery = db.collection('users').limit(1);
      const snapshot = await testQuery.get();
      diagnostics.tests.firestoreRead = {
        status: 'success',
        message: 'Can read from Firestore',
        documentsFound: snapshot.size
      };
    } catch (error: any) {
      diagnostics.tests.firestoreRead = {
        status: 'failed',
        error: error.message,
        code: error.code,
        details: error.details
      };
      diagnostics.errors.push(`Firestore read failed: ${error.message} (Code: ${error.code})`);
      
      // Check for specific permission errors
      if (error.code === 7 || error.code === 'PERMISSION_DENIED' || error.message?.includes('PERMISSION_DENIED')) {
        diagnostics.errors.push('⚠️ PERMISSION DENIED - Service account needs "Cloud Datastore User" role');
      }
    }

    // Test 4: Firestore Write Permission (test write to a test collection)
    diagnostics.tests.firestoreWrite = { status: 'testing' };
    try {
      const testDocRef = db.collection('_test').doc('permissions-check');
      await testDocRef.set({
        test: true,
        timestamp: new Date().toISOString()
      });
      await testDocRef.delete(); // Clean up
      diagnostics.tests.firestoreWrite = {
        status: 'success',
        message: 'Can write to Firestore'
      };
    } catch (error: any) {
      diagnostics.tests.firestoreWrite = {
        status: 'failed',
        error: error.message,
        code: error.code
      };
      diagnostics.errors.push(`Firestore write failed: ${error.message} (Code: ${error.code})`);
    }

    // Test 5: Auth Access
    diagnostics.tests.auth = { status: 'testing' };
    try {
      auth(); // Test auth initialization
      diagnostics.tests.auth = {
        status: 'success',
        message: 'Auth instance accessible'
      };
    } catch (error: any) {
      diagnostics.tests.auth = {
        status: 'failed',
        error: error.message
      };
      diagnostics.errors.push(`Auth access failed: ${error.message}`);
    }

    // Test 6: Specific Collections Access
    const collectionsToTest = ['rewards', 'referrals', 'tokens', 'users'];
    diagnostics.tests.collections = {};
    
    for (const collectionName of collectionsToTest) {
      try {
        const testSnapshot = await db.collection(collectionName).limit(1).get();
        diagnostics.tests.collections[collectionName] = {
          status: 'success',
          accessible: true,
          documentCount: testSnapshot.size
        };
      } catch (error: any) {
        diagnostics.tests.collections[collectionName] = {
          status: 'failed',
          accessible: false,
          error: error.message,
          code: error.code
        };
        diagnostics.errors.push(`Cannot access ${collectionName}: ${error.message}`);
      }
    }

    // Overall status
    const hasFailures = diagnostics.errors.length > 0;
    diagnostics.success = !hasFailures;

    return NextResponse.json(diagnostics, {
      status: hasFailures ? 500 : 200
    });

  } catch (error: any) {
    diagnostics.errors.push(`Unexpected error: ${error.message}`);
    diagnostics.success = false;
    return NextResponse.json(diagnostics, { status: 500 });
  }
}

