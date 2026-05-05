import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const getProjectId = () => process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const getClientEmail = () => process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const getPrivateKey = () => {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!key) return undefined;
  // Handle both escaped and literal newlines
  return key.replace(/\\n/g, '\n');
};

const getDatabaseId = () => process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)";

let adminApp: admin.app.App | null = null;
let adminDb: any = null;

export function getAdminApp(): admin.app.App | null {
  if (adminApp) return adminApp;

  const projectId = getProjectId();
  const clientEmail = getClientEmail();
  const privateKey = getPrivateKey();

  try {
    if (!admin.apps.length) {
      if (projectId && clientEmail && privateKey) {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId
        });
        console.log(`[FirebaseAdmin] Initialized with Service Account: ${projectId}`);
      } else {
        console.warn(`[FirebaseAdmin] Missing Service Account credentials. Attempting logic-only fallback.`);
        adminApp = admin.initializeApp({
          projectId: projectId || undefined,
        });
      }
    } else {
      adminApp = admin.app();
    }
    return adminApp;
  } catch (error) {
    console.error("[FirebaseAdmin] Initialization failure:", error);
    return null;
  }
}

export function getAdminDb() {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (!app) return null;
  
  const dbId = getDatabaseId();
  try {
    adminDb = getFirestore(app, dbId === "(default)" ? undefined : dbId);
    return adminDb;
  } catch (e) {
    console.error("[FirebaseAdmin] Firestore init failed:", e);
    return null;
  }
}

export { admin };
export default admin;
