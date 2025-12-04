import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  const envInfo = {
    // Google Cloud environment detection
    K_SERVICE: process.env.K_SERVICE || null,
    K_REVISION: process.env.K_REVISION || null,
    
    // Check for admin credentials in env
    ADMIN_PROJECT_ID: process.env.ADMIN_PROJECT_ID ? 'SET' : 'MISSING',
    ADMIN_CLIENT_EMAIL: process.env.ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING',
    ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY 
      ? `SET (length: ${process.env.ADMIN_PRIVATE_KEY.length}, starts: ${process.env.ADMIN_PRIVATE_KEY.substring(0, 30)}...)` 
      : 'MISSING',
    
    // Node environment
    NODE_ENV: process.env.NODE_ENV,
  };

  let result = {
    status: 'unknown',
    error: null as string | null,
    firestoreTest: null as { success: boolean; docsFound?: number; error?: string } | null,
  };
  
  try {
    // Get the adminDb - this will initialize Firebase Admin if not already done
    const db = adminDb();
    
    result.status = 'initialized';
    
    // Try a simple Firestore read to verify everything works
    try {
      const testRef = db.collection('users').limit(1);
      const snapshot = await testRef.get();
      result.firestoreTest = {
        success: true,
        docsFound: snapshot.size,
      };
      result.status = 'SUCCESS';
    } catch (firestoreError) {
      result.firestoreTest = {
        success: false,
        error: firestoreError instanceof Error ? firestoreError.message : String(firestoreError),
      };
      result.status = 'FIRESTORE_FAILED';
      result.error = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
    }
  } catch (error) {
    result.status = 'INIT_FAILED';
    result.error = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envInfo,
    firebase: result,
  });
}

