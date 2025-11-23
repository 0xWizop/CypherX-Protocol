if (process.env.NODE_ENV === 'development') {
  console.log("Starting firebase-client.ts execution");
}

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore as getClientFirestore, Firestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

// Client-side Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "homebase-dapp.firebaseapp.com",
  projectId: "homebase-dapp",
  storageBucket: "homebase-dapp.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log and validate client-side environment variables
const logEnvStatus = (key: string, value: string | undefined) =>
  value ? `${key}: Set` : `${key}: Missing`;
console.log("Firebase Client Config:", {
  apiKey: logEnvStatus("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  messagingSenderId: logEnvStatus(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: logEnvStatus("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  authDomain: logEnvStatus("authDomain", firebaseConfig.authDomain),
  projectId: logEnvStatus("projectId", firebaseConfig.projectId),
  storageBucket: logEnvStatus("storageBucket", firebaseConfig.storageBucket),
});

const missingClientEnvVars = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}).filter(([, value]) => !value);

// Initialize client-side Firebase app
let clientApp;
if (missingClientEnvVars.length > 0) {
  console.error(
    `Missing client-side Firebase environment variables: ${missingClientEnvVars
      .map(([key]) => key)
      .join(", ")}`
  );
  throw new Error("Firebase initialization failed: Missing environment variables");
} else {
  try {
    clientApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    console.log(
      "Client-side Firebase app initialized:",
      clientApp.name,
      "Project ID:",
      clientApp.options.projectId,
      "Storage Bucket:",
      clientApp.options.storageBucket
    );
  } catch (error: unknown) {
    console.error("Client-side Firebase initialization error:", error);
    throw new Error("Firebase initialization failed");
  }
}

// Initialize client-side services
let clientDb: Firestore;
try {
  clientDb = getClientFirestore(clientApp);
  console.log("Client-side Firestore initialized: Success");
} catch (error: unknown) {
  console.error("Client-side Firestore initialization failed:", error);
  throw new Error("Firestore initialization failed");
}

let auth: Auth;
try {
  auth = getAuth(clientApp);
  console.log("Client-side Auth initialized: Success");
} catch (error: unknown) {
  console.error("Client-side Auth initialization failed:", error);
  throw new Error("Auth initialization failed");
}

let storage: FirebaseStorage;
try {
  storage = getStorage(clientApp, "homebase-dapp.appspot.com");
  console.log("Client-side Storage initialized: Success, Bucket:", firebaseConfig.storageBucket);
} catch (error: unknown) {
  console.error("Client-side Storage initialization failed:", error);
  throw new Error("Storage initialization failed");
}

// Function to listen to auth state changes with role checking
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
        const roles = userDoc.exists() ? userDoc.data()?.roles || {} : {};
        console.log(`Auth state changed: User ${user.uid} signed in, Roles:`, roles);
        callback(user, roles);
      } catch (error: unknown) {
        console.error(`Error fetching roles for user ${user.uid}:`, error);
        callback(user, {});
      }
    } else {
      console.log("Auth state changed: No user signed in");
      callback(null);
    }
  });
};

export { clientDb as db, auth, storage, listenToAuthState };