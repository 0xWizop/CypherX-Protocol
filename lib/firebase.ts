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

// Server-side Firebase Admin - USE lib/firebase-admin.ts instead!
// This file is for CLIENT-SIDE Firebase only.
// Import adminDb from '@/lib/firebase-admin' for server-side operations.

export { clientDb as db, auth, storage, listenToAuthState };