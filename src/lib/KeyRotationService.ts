import CryptoJS from "crypto-js";

export interface ApiKeyData {
  id: string;
  key: string;
  name: string;
  requestsThisMinute: number;
  requestsToday: number;
  lastResetMinute: any;
  lastResetDay: any;
  status: "active" | "exhausted";
  priority: number;
}

export class KeyRotationService {
  private db: any; // admin.firestore.Firestore
  private secret: string;

  constructor(db: any, secret: string) {
    if (!db) {
      console.warn("[KeyRotation] Firestore instance (db) is missing. Rotation will fail.");
    }
    this.db = db;
    this.secret = secret;
  }

  private decrypt(ciphertext: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.secret);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) return ciphertext; // Return raw if decryption failed/not encrypted
      return decrypted;
    } catch (e) {
      console.warn("[KeyRotation] Decryption failed, using raw key.");
      return ciphertext;
    }
  }

  public encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.secret).toString();
  }

  async getCurrentKey(): Promise<ApiKeyData | null> {
    try {
      if (!this.db) {
        console.error("[KeyRotation] Cannot get key: Firestore DB is not initialized.");
        return null; // Return null so fallback logic in server.ts can take over
      }
      console.log("[KeyRotation] Fetching keys from Firestore...");
      const keysRef = this.db.collection("apiKeys");
      const querySnapshot = await keysRef
        .where("status", "==", "active")
        .get();
      
      console.log(`[KeyRotation] Found ${querySnapshot.size} active keys.`);
      if (querySnapshot.empty) return null;

      const now = new Date();
      let selectedKey: ApiKeyData | null = null;
      let selectedDoc: any = null;

      // Sort in memory
      const docs = querySnapshot.docs.sort((a: any, b: any) => {
        const dataA = a.data();
        const dataB = b.data();
        const priorityA = typeof dataA.priority === 'number' ? dataA.priority : 100;
        const priorityB = typeof dataB.priority === 'number' ? dataB.priority : 100;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return (dataA.requestsThisMinute || 0) - (dataB.requestsThisMinute || 0);
      });

      console.log("[KeyRotation] Processing sorted keys...");
      for (const doc of docs) {
        const data = doc.data() as ApiKeyData;
        console.log(`[KeyRotation] Checking key: ${doc.id} (Usage: ${data.requestsThisMinute}/15)`);
        
        // 1. Reset Minute
        if (this.shouldResetMinute(data, now)) {
          console.log(`[KeyRotation] Resetting minute counter for ${doc.id}`);
          await doc.ref.update({
            requestsThisMinute: 0,
            lastResetMinute: now,
            status: "active"
          });
          data.requestsThisMinute = 0;
        }

        // 2. Reset Day
        if (this.shouldResetDay(data, now)) {
          console.log(`[KeyRotation] Resetting day counter for ${doc.id}`);
          await doc.ref.update({
            requestsToday: 0,
            lastResetDay: now,
            status: "active"
          });
          data.requestsToday = 0;
        }

        // 3. Selection
        if (data.requestsThisMinute < 15 && (data.requestsToday || 0) < 1500) {
          selectedKey = { id: doc.id, ...data };
          selectedDoc = doc;
          console.log(`[KeyRotation] Selected key: ${doc.id}`);
          break;
        }
      }

      // 4. Force reset if all cycles exhausted
      if (!selectedKey && docs.length > 0) {
        console.warn("[KeyRotation] All active keys exhausted in current minute. Resetting all...");
        for (const doc of docs) {
          await doc.ref.update({
            requestsThisMinute: 0,
            lastResetMinute: now
          });
        }
        const firstDoc = docs[0];
        selectedKey = { id: firstDoc.id, ...(firstDoc.data() as ApiKeyData), requestsThisMinute: 0 };
        selectedDoc = firstDoc;
      }

      if (selectedKey && selectedDoc) {
        console.log(`[KeyRotation] Incrementing usage for ${selectedKey.id}`);
        await selectedDoc.ref.update({
          requestsThisMinute: (selectedKey.requestsThisMinute || 0) + 1,
          requestsToday: (selectedKey.requestsToday || 0) + 1,
          updatedAt: now
        });

        const decrypted = this.decrypt(selectedKey.key);
        return { ...selectedKey, key: decrypted };
      }

      console.error("[KeyRotation] Failed to find or select a key.");
      return null;
    } catch (error: any) {
      console.error("[KeyRotation] CRITICAL ERROR in getCurrentKey:", error.message, error.stack);
      throw error; // Rethrow so server can catch it
    }
  }

  async incrementUsage(keyId: string) {
    // Usage is mostly handled in getCurrentKey, but keeping this for extra telemetry
    try {
      const docRef = this.db.collection("apiKeys").doc(keyId);
      await docRef.update({
        updatedAt: new Date()
      });
    } catch (e) {
      console.error("Usage increment update failed:", e);
    }
  }

  async markExhausted(keyId: string) {
    try {
      const docRef = this.db.collection("apiKeys").doc(keyId);
      await docRef.update({
        status: "exhausted",
        updatedAt: new Date()
      });
    } catch (e) {
      console.error("Mark exhausted failed:", e);
    }
  }

  private shouldResetMinute(key: ApiKeyData, now: Date): boolean {
    if (!key.lastResetMinute) return true;
    const lastReset = key.lastResetMinute.toDate ? key.lastResetMinute.toDate() : new Date(key.lastResetMinute);
    return now.getTime() - lastReset.getTime() > 60000;
  }

  private shouldResetDay(key: ApiKeyData, now: Date): boolean {
    if (!key.lastResetDay) return true;
    const lastReset = key.lastResetDay.toDate ? key.lastResetDay.toDate() : new Date(key.lastResetDay);
    return now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
  }

  async resetAllKeys() {
    try {
      const keysRef = this.db.collection("apiKeys");
      const querySnapshot = await keysRef.get();
      const now = new Date();
      for (const d of querySnapshot.docs) {
        await d.ref.update({
          requestsThisMinute: 0,
          lastResetMinute: now,
          status: "active"
        });
      }
    } catch (error: any) {
      console.error("[KeyRotation] Error resetting keys:", error);
    }
  }
}
