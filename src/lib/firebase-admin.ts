import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const databaseId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)";

let adminApp: admin.app.App | null = null;

try {
  if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
      // Explicit service account
      console.log(`[FirebaseAdmin] Attempting Service Account Init. ProjectID=${projectId}`);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId
      });
    } else {
      // Application Default Credentials (ADC)
      console.warn(`[FirebaseAdmin] Service Account env vars missing. Falling back to ADC.`);
      adminApp = admin.initializeApp({
        projectId: projectId || undefined,
      });
    }
  } else {
    adminApp = admin.app();
  }
} catch (error) {
  console.error("[FirebaseAdmin] Initialization failure:", error);
}

// Export adminDb with a safe check
export const adminDb = adminApp ? getFirestore(adminApp, databaseId === "(default)" ? undefined : databaseId) : null;
if (!adminDb) {
    console.error("[FirebaseAdmin] adminDb failed to initialize. Firestore operations will fail.");
}

export default admin;
