import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const databaseId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)";

let adminApp;

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      projectId
    });
    console.log(`[FirebaseAdmin] Initialized with Service Account: ${projectId}`);
  } else {
    adminApp = admin.initializeApp({
      projectId: projectId || undefined,
    });
    console.log(`[FirebaseAdmin] Initialized with ADC: ${projectId || 'default'}`);
  }
} else {
  adminApp = admin.app();
}

export const adminDb = getFirestore(adminApp, databaseId === "(default)" ? undefined : databaseId);
export default admin;
