import admin from "firebase-admin";

let _adminDb: admin.firestore.Firestore | null = null;
let _adminStorage: admin.storage.Storage | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin(): void {
  // Already successfully initialized
  if (isInitialized && _adminDb) {
    return;
  }

  // If we previously failed, throw that error
  if (initializationError) {
    throw initializationError;
  }

  console.log("🚀 Firebase Admin: Starting initialization...");
  
  // Log environment for debugging
  console.log("🔧 Environment check:", {
    NODE_ENV: process.env.NODE_ENV,
    hasAdminProjectId: !!process.env.ADMIN_PROJECT_ID,
    hasAdminClientEmail: !!process.env.ADMIN_CLIENT_EMAIL,
    hasAdminPrivateKey: !!process.env.ADMIN_PRIVATE_KEY,
    privateKeyLength: process.env.ADMIN_PRIVATE_KEY?.length || 0,
  });

  try {
    // If there's an existing app, delete it so we can initialize fresh with our credentials
    if (admin.apps.length > 0) {
      console.log("🔧 Deleting existing Firebase app to reinitialize with proper credentials...");
      admin.apps.forEach((app) => {
        if (app) {
          app.delete().catch(() => {});
        }
      });
    }

    // Get credentials from environment
    const projectId = process.env.ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push("ADMIN_PROJECT_ID");
      if (!clientEmail) missing.push("ADMIN_CLIENT_EMAIL");
      if (!privateKey) missing.push("ADMIN_PRIVATE_KEY");
      
      const errorMsg = `Missing required Firebase Admin credentials: ${missing.join(", ")}`;
      console.error("❌ " + errorMsg);
      initializationError = new Error(errorMsg);
      throw initializationError;
    }

    // Normalize the private key
    const normalizedKey = privateKey
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/\\n/g, "\n")       // Replace literal \n with newlines
      .replace(/\\r/g, "")         // Remove carriage returns
      .trim();

    // Validate private key format
    if (!normalizedKey.includes("-----BEGIN PRIVATE KEY-----")) {
      const errorMsg = "Invalid private key format - missing BEGIN marker";
      console.error("❌ " + errorMsg);
      initializationError = new Error(errorMsg);
      throw initializationError;
    }

    console.log("🔧 Initializing Firebase Admin with credentials...");
    console.log("🔧 Project ID:", projectId);
    console.log("🔧 Client Email:", clientEmail);
    console.log("🔧 Private Key Length:", normalizedKey.length);

    // Initialize the app
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: normalizedKey,
      } as admin.ServiceAccount),
      projectId,
      storageBucket: `${projectId}.appspot.com`,
    });

    // Get Firestore instance
    _adminDb = admin.firestore();
    _adminDb.settings({ ignoreUndefinedProperties: true });
    
    // Get Storage instance
    _adminStorage = admin.storage();
    
    isInitialized = true;
    console.log("✅ Firebase Admin initialized successfully!");

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Firebase Admin initialization failed:", errorMsg);
    
    _adminDb = null;
    _adminStorage = null;
    isInitialized = false;
    initializationError = error instanceof Error ? error : new Error(errorMsg);
    
    throw initializationError;
  }
}

// Get Firestore database instance
export function adminDb(): admin.firestore.Firestore {
  if (typeof window !== "undefined") {
    throw new Error("adminDb can only be used on the server-side");
  }

  if (!isInitialized || !_adminDb) {
    initializeFirebaseAdmin();
  }

  if (!_adminDb) {
    throw new Error("Firebase Admin Firestore is not available");
  }

  return _adminDb;
}

// Get Storage instance
export function adminStorage(): admin.storage.Storage {
  if (typeof window !== "undefined") {
    throw new Error("adminStorage can only be used on the server-side");
  }

  if (!isInitialized || !_adminStorage) {
    initializeFirebaseAdmin();
  }

  if (!_adminStorage) {
    throw new Error("Firebase Admin Storage is not available");
  }

  return _adminStorage;
}

// Get Auth instance
export function auth(): admin.auth.Auth {
  if (typeof window !== "undefined") {
    throw new Error("auth can only be used on the server-side");
  }

  if (!isInitialized) {
    initializeFirebaseAdmin();
  }

  return admin.auth();
}
