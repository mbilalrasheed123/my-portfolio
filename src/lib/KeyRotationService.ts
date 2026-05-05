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
      const keysRef = this.db.collection("apiKeys");
      // Find active keys, ordered by priority then usage
      const querySnapshot = await keysRef
        .where("status", "==", "active")
        .orderBy("priority", "asc")
        .orderBy("requestsThisMinute", "asc")
        .get();
      
      const now = new Date();
      let selectedKey: ApiKeyData | null = null;
      let selectedDoc: any = null;

      for (const doc of querySnapshot.docs) {
        const data = doc.data() as ApiKeyData;
        
        // 1. Check if we need to reset the minute counter (for serverless environments)
        if (this.shouldResetMinute(data, now)) {
          await doc.ref.update({
            requestsThisMinute: 0,
            lastResetMinute: now,
            status: "active"
          });
          data.requestsThisMinute = 0;
        }

        // 2. Check daily limits
        if (this.shouldResetDay(data, now)) {
          await doc.ref.update({
            requestsToday: 0,
            lastResetDay: now,
            status: "active"
          });
          data.requestsToday = 0;
        }

        // 3. Selection Logic (15 req per "rotation" cycle)
        if (data.requestsThisMinute < 15 && data.requestsToday < 1500) {
          selectedKey = { id: doc.id, ...data };
          selectedDoc = doc;
          break;
        }
      }

      // 4. If all keys are at 15 for this minute, reset them all and take the first one
      if (!selectedKey && querySnapshot.docs.length > 0) {
        console.log("[KeyRotation] All keys used up for this cycle, resetting...");
        for (const doc of querySnapshot.docs) {
          await doc.ref.update({
            requestsThisMinute: 0,
            lastResetMinute: now
          });
        }
        const firstDoc = querySnapshot.docs[0];
        selectedKey = { id: firstDoc.id, ...(firstDoc.data() as ApiKeyData), requestsThisMinute: 0 };
        selectedDoc = firstDoc;
      }

      if (selectedKey && selectedDoc) {
        // Increment usage atomically
        await selectedDoc.ref.update({
          requestsThisMinute: (selectedKey.requestsThisMinute || 0) + 1,
          requestsToday: (selectedKey.requestsToday || 0) + 1,
          updatedAt: now
        });

        return { ...selectedKey, key: this.decrypt(selectedKey.key) };
      }

      return null;
    } catch (error) {
      console.error("[KeyRotation] Error getting current key:", error);
      return null;
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
