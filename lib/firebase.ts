import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import { Firestore as AdminFirestore } from "firebase-admin/firestore";
import { Storage } from "firebase-admin/storage";
import type { App } from "firebase-admin/app";
import * as dotenv from "dotenv"; // Import dotenv for .env loading

// Load environment variables from .env file
dotenv.config();

interface FirebaseError extends Error {
  code?: string;
}

// Client-side Firebase config with fallbacks
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC-K5MMV2Bh2s1GJblOw2Ji-d8S1rccqso",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "homebase-dapp.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "homebase-dapp",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "homebase-dapp.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "492562110747",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:492562110747:web:db9b97a1f3bcb763b05bbe",
};

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log("Firebase Client Config:", {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Set" : "Using fallback",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "Set" : "Using fallback",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Set" : "Using fallback",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? "Set" : "Using fallback",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? "Set" : "Using fallback",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? "Set" : "Using fallback",
  });
}

// Initialize client-side Firebase app
let clientApp;
try {
  clientApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  if (process.env.NODE_ENV === 'development') {
    console.log(
      "Client-side Firebase app initialized:",
      clientApp.name,
      "Project ID:",
      clientApp.options.projectId,
      "Storage Bucket:",
      clientApp.options.storageBucket
    );
  }
} catch (error: unknown) {
  console.error("Client-side Firebase initialization error:", {
    message: error instanceof Error ? error.message : String(error),
  });
  throw new Error("Firebase initialization failed: Client-side app setup error");
}

// Initialize client-side services
let clientDb: Firestore;
try {
  clientDb = getClientFirestore(clientApp);
  if (process.env.NODE_ENV === 'development') {
    console.log("Client-side Firestore initialized: Success");
  }
} catch (error: unknown) {
  console.error("Client-side Firestore initialization failed:", {
    message: error instanceof Error ? error.message : String(error),
  });
  throw new Error("Firestore initialization failed: Client-side Firestore setup error");
}

let auth: Auth;
try {
  auth = getAuth(clientApp);
  if (process.env.NODE_ENV === 'development') {
    console.log("Client-side Auth initialized: Success");
  }
} catch (error: unknown) {
  console.error("Client-side Auth initialization failed:", {
    message: error instanceof Error ? error.message : String(error),
  });
  throw new Error("Auth initialization failed: Client-side Auth setup error");
}

let storage: FirebaseStorage;
try {
  storage = getStorage(clientApp, firebaseConfig.storageBucket);
  if (process.env.NODE_ENV === 'development') {
    console.log(
      "Client-side Storage initialized: Success, Bucket:",
      firebaseConfig.storageBucket
    );
  }
} catch (error: unknown) {
  console.error("Client-side Storage initialization failed:", {
    message: error instanceof Error ? error.message : String(error),
  });
  throw new Error("Storage initialization failed: Client-side Storage setup error");
}

// Listen to auth state + roles
const listenToAuthState = (
  callback: (user: User | null, roles?: { [key: string]: boolean }) => void
) => {
  if (!auth) {
    console.error("Auth not initialized. Cannot listen to auth state.");
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(clientDb, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        let roles: { [key: string]: boolean } = {};
        if (userDoc.exists()) {
          roles = (userDoc.data() as { roles?: { [key: string]: boolean } }).roles || {};
          console.log(
            `Auth state changed: User ${user.uid} signed in, Roles:`,
            roles
          );
        } else {
          console.log(`Creating user document for ${user.uid}`);
          const username = user.displayName?.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || `user_${user.uid}`;
          if (!/^[a-z0-9\-_]+$/.test(username)) {
            throw new Error(`Invalid username format for user ${user.uid}: ${username}`);
          }
          await setDoc(userDocRef, {
            email: user.email || "",
            username: username,
            displayName: user.displayName || `User ${user.uid.slice(0, 8)}`,
            photoURL: user.photoURL || "",
            createdAt: serverTimestamp(),
            preferences: {
              notifications: {
                mover: true,
                loser: true,
                volume_spike: true,
                price_spike: true,
                news: true,
                article: true,
                ai_index: true,
                eth_stats: true,
                new_token: true,
              },
              favorites: [],
              notificationFilter: { type: "all", excludeTypes: [] },
              panelWidths: {
                sysUpdate: 33.33,
                terminalOutput: 33.33,
                notificationCenter: 33.33,
              },
            },
            roles: {},
          });
          console.log(`User document created for ${user.uid}`);
        }
        callback(user, roles);
      } catch (error: unknown) {
        const firebaseError = error as FirebaseError;
        console.error(`Error handling auth state for user ${user.uid}:`, {
          message: firebaseError.message || String(error),
          code: firebaseError.code,
          stack: firebaseError.stack,
        });
        callback(user, {});
      }
    } else {
      console.log("Auth state changed: No user signed in");
      callback(null);
    }
  });
};

// Server-side Firebase Admin init
let adminDb: AdminFirestore;
let adminStorage: Storage;
let adminApp: App;
let adminInitialized = false;

if (typeof window === "undefined" && !adminInitialized) {
  (async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("Starting Firebase Admin initialization...");
        console.log("Raw Firebase Admin Env Vars:", {
          FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "Missing",
          FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "Missing",
          FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "Set" : "Missing",
        });
      }

      const requiredEnvVars = {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
      };
      const missingAdminEnvVars = Object.entries(requiredEnvVars).filter(([, value]) => !value);
      if (missingAdminEnvVars.length > 0) {
        const errorMessage = `Missing server-side Firebase Admin environment variables: ${missingAdminEnvVars.map(([key]) => key).join(", ")}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log("Attempting to import firebase-admin modules...");
      }
      const {
        initializeApp: initializeAdminApp,
        getApps: getAdminApps,
        cert,
      } = await import("firebase-admin/app");
      const { getFirestore: getAdminFirestore } = await import("firebase-admin/firestore");
      const { getStorage: getAdminStorage } = await import("firebase-admin/storage");

      const normalizePrivateKey = (key: string | undefined): string => {
        if (!key) throw new Error("FIREBASE_PRIVATE_KEY is undefined or empty");
        let normalizedKey = key
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\n+/g, "\n")
          .trim();
        if (process.env.NODE_ENV === 'development') {
          console.log("Raw Private Key Length:", normalizedKey.length);
        }
        if (!normalizedKey.startsWith("-----BEGIN PRIVATE KEY-----\n")) {
          normalizedKey = "-----BEGIN PRIVATE KEY-----\n" + normalizedKey;
        }
        if (!normalizedKey.endsWith("\n-----END PRIVATE KEY-----\n")) {
          normalizedKey = normalizedKey + "\n-----END PRIVATE KEY-----\n";
        }
        if (!normalizedKey.includes("PRIVATE KEY")) {
          throw new Error("FIREBASE_PRIVATE_KEY is malformed: Missing expected key structure");
        }
        if (process.env.NODE_ENV === 'development') {
          console.log("Normalized Private Key Length:", normalizedKey.length, "Sample:", normalizedKey.substring(0, 20) + "...");
        }
        return normalizedKey;
      };

      const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      if (process.env.NODE_ENV === 'development') {
        console.log("Private Key normalized successfully");
      }

      if (!getAdminApps().length) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Initializing Firebase Admin app...");
        }
        adminApp = initializeAdminApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey,
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        });
        if (process.env.NODE_ENV === 'development') {
          console.log("Firebase Admin app initialized successfully");
        }
      } else {
        adminApp = getAdminApps()[0];
        if (process.env.NODE_ENV === 'development') {
          console.log("Firebase Admin app already initialized");
        }
      }

      adminDb = getAdminFirestore();
      if (process.env.NODE_ENV === 'development') {
        console.log("Admin Firestore initialized: Success");
      }

      // Enable ignoreUndefinedProperties to prevent undefined value errors
      // Only set settings if not already set
      try {
        adminDb.settings({
          ignoreUndefinedProperties: true
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Firestore settings already configured, skipping...");
        }
      }

      adminStorage = getAdminStorage(adminApp);
      if (process.env.NODE_ENV === 'development') {
        console.log("Admin Storage initialized: Success, Bucket:", adminStorage.bucket().name);
      }

      // Test Firestore connectivity
      if (process.env.NODE_ENV === 'development') {
        console.log("Testing Firestore connectivity...");
      }
      await adminDb.collection("test").doc("init-check").set({
        timestamp: new Date(),
        initializedBy: "firebase.ts",
      });
      if (process.env.NODE_ENV === 'development') {
        console.log("Admin SDK connectivity test: Firestore write successful");
      }

      // Mark as initialized
      adminInitialized = true;

      // Test Storage connectivity
      if (process.env.NODE_ENV === 'development') {
        console.log("Testing Storage connectivity...");
      }
      try {
        const bucket = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
        const [exists] = await bucket.exists();
        if (!exists) {
          throw new Error("Storage bucket does not exist: " + process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
        }
        const [metadata] = await bucket.getMetadata();
        if (process.env.NODE_ENV === 'development') {
          console.log("Admin Storage connectivity test: Metadata retrieved", {
            bucket: metadata.name,
            location: metadata.location,
          });
        }
      } catch (error: unknown) {
        console.error("Admin Storage connectivity test failed:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Admin Storage initialization failed: Unable to connect to storage bucket");
      }
    } catch (error: unknown) {
      console.error("Firebase Admin initialization error:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Mark as initialized to prevent retries
      adminInitialized = true;
      throw new Error("Firebase Admin initialization failed: " + (error instanceof Error ? error.message : String(error)));
    }
  })();
}

export { clientDb as db, auth, storage, adminDb, adminStorage, listenToAuthState };