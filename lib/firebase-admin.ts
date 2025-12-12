import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

let adminDb: admin.firestore.Firestore | null = null;
let adminStorage: admin.storage.Storage | null = null;
let isInitialized = false;

const initializeAdmin = () => {
  if (isInitialized) return;
  
  try {
    console.log("🚀 Starting Firebase Admin initialization...");

    // Try multiple authentication methods in order of preference
    let initialized = false;
    const errorMessages: string[] = [];

    // Method 1: Try service account from JSON file (highest priority - more reliable)
    try {
      console.log("🔧 Method 1: Trying service account from JSON file...");
      const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountFile);
        
        // Normalize private key - ensure proper formatting
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .trim();
        }
        
        console.log("🔧 Service account JSON loaded:", {
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKeyLength: serviceAccount.private_key?.length || 0,
          hasPrivateKey: !!serviceAccount.private_key
        });
        
        if (!admin.apps.length) {
          try {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id,
            });
            console.log("✅ Firebase Admin app initialized");
          } catch (initError) {
            console.error("❌ Firebase Admin initialization error:", initError);
            throw initError;
          }
        }
        
        adminDb = admin.firestore();
        // Set Firestore settings to avoid authentication issues
        adminDb.settings({ ignoreUndefinedProperties: true });
        adminStorage = admin.storage();
        isInitialized = true;
        initialized = true;
        console.log("✅ Successfully initialized with service account from JSON file");
      } else {
        console.log("⚠️  Service account JSON file not found at:", serviceAccountPath);
      }
    } catch (error) {
      const errorMsg = `Service account JSON failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.log("❌ " + errorMsg);
      console.error("🔧 Full error:", error);
      errorMessages.push(errorMsg);
    }

    // Method 2: Try environment variables (fallback)
    if (!initialized) {
      try {
        console.log("🔧 Method 2: Trying environment variables...");
        console.log("🔧 FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing");
        console.log("🔧 FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? "✅ Set" : "❌ Missing");
        console.log("🔧 FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "✅ Set" : "❌ Missing");
        
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
          const normalizePrivateKey = (key: string): string => {
            return key
              .replace(/\\n/g, "\n")
              .replace(/\\r/g, "")
              .replace(/\s+/g, "")
              .trim();
          };

          const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
          };

          console.log("🔧 Service account config:", {
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKeyLength: serviceAccount.privateKey.length
          });

          if (!admin.apps.length) {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: process.env.FIREBASE_PROJECT_ID
            });
          }
          
          adminDb = admin.firestore();
          adminStorage = admin.storage();
          isInitialized = true;
          initialized = true;
          console.log("✅ Successfully initialized with environment variables");
        } else {
          console.log("⚠️  Environment variables not complete");
          console.log("🔧 Missing:", {
            FIREBASE_PROJECT_ID: !process.env.FIREBASE_PROJECT_ID,
            FIREBASE_CLIENT_EMAIL: !process.env.FIREBASE_CLIENT_EMAIL,
            FIREBASE_PRIVATE_KEY: !process.env.FIREBASE_PRIVATE_KEY
          });
        }
      } catch (error) {
        const errorMsg = `Environment variables failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log("❌ " + errorMsg);
        console.error("🔧 Full error:", error);
        errorMessages.push(errorMsg);
      }
    }

    // Method 3: Try Firebase CLI credentials (lowest priority)
    if (!initialized) {
      try {
        console.log("🔧 Method 2: Trying service account from JSON file...");
        const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
        
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
          const serviceAccount = JSON.parse(serviceAccountFile);
          
          if (!admin.apps.length) {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id
            });
          }
          
          adminDb = admin.firestore();
          adminStorage = admin.storage();
          isInitialized = true;
          initialized = true;
          console.log("✅ Successfully initialized with service account from JSON file");
        } else {
          console.log("⚠️  Service account JSON file not found");
        }
      } catch (error) {
        const errorMsg = `Service account JSON failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log("❌ " + errorMsg);
        errorMessages.push(errorMsg);
      }
    }

    // Method 3: Try Firebase CLI credentials (fallback)
    if (!initialized) {
      try {
        console.log("🔧 Method 3: Trying Firebase CLI credentials...");
        
        if (!admin.apps.length) {
          admin.initializeApp({
            projectId: 'homebase-dapp',
          });
        }
        
        adminDb = admin.firestore();
        adminStorage = admin.storage();
        isInitialized = true;
        initialized = true;
        console.log("✅ Successfully initialized with Firebase CLI credentials");
      } catch (error) {
        const errorMsg = `Firebase CLI credentials failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log("❌ " + errorMsg);
        errorMessages.push(errorMsg);
      }
    }

    if (!initialized) {
      console.error("❌ All Firebase Admin initialization methods failed:");
      errorMessages.forEach((msg, index) => {
        console.error(`  ${index + 1}. ${msg}`);
      });
      throw new Error("All Firebase Admin initialization methods failed. Please check your Firebase project configuration and service account permissions.");
    }

    console.log("✅ Firebase Admin initialization completed successfully");

  } catch (error: unknown) {
    console.error("❌ Firebase Admin initialization error:", error);
    
    // Reset state on failure
    adminDb = null;
    adminStorage = null;
    isInitialized = false;
    
    if (error instanceof Error) {
      throw new Error(`Firebase Admin initialization failed: ${error.message}`);
    } else {
      throw new Error("Firebase Admin initialization failed with unknown error");
    }
  }
};

const getAdminDb = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminDb can only be used on the server-side");
  }
  
  console.log("🔧 getAdminDb called, isInitialized:", isInitialized, "adminDb:", !!adminDb);
  
  if (!isInitialized) {
    try {
      console.log("🔧 Initializing Firebase Admin...");
      initializeAdmin();
      console.log("🔧 Firebase Admin initialization completed");
    } catch (error) {
      console.error("🔧 Failed to initialize Firebase Admin:", error);
      throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  if (!adminDb) {
    console.error("🔧 adminDb is null after initialization");
    throw new Error("Firebase Admin Firestore is not available - initialization failed");
  }
  
  console.log("🔧 Returning adminDb successfully");
  return adminDb;
};

const getAdminStorage = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminStorage can only be used on the server-side");
  }
  
  if (!isInitialized) {
    initializeAdmin();
  }
  
  if (!adminStorage) {
    throw new Error("Firebase Admin Storage is not available - initialization failed");
  }
  
  return adminStorage;
};

const getAdminAuth = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminAuth can only be used on the server-side");
  }
  
  if (!isInitialized) {
    try {
      initializeAdmin();
    } catch (error) {
      console.error("Failed to initialize Firebase Admin:", error);
      throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return admin.auth();
};
export { getAdminDb as adminDb, getAdminStorage as adminStorage, getAdminAuth as auth };
