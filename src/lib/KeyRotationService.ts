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
    if (!ciphertext) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.secret);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      if (!plaintext) {
        // Fallback for unencrypted keys or wrong secret
        return ciphertext;
      }
      return plaintext;
    } catch (error) {
      console.warn("[KeyRotation] Decryption failed, returning raw value.");
      return ciphertext;
    }
  }

  public encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.secret).toString();
  }

  async getCurrentKey(): Promise<ApiKeyData | null> {
    try {
      const keysRef = this.db.collection("apiKeys");
      const querySnapshot = await keysRef.orderBy("priority", "asc").get();
      
      const now = new Date();
      const keys: ApiKeyData[] = [];
      
      querySnapshot.forEach((doc: any) => {
        keys.push({ id: doc.id, ...doc.data() } as ApiKeyData);
      });

      // Filter and Rotate
      for (const key of keys) {
        // Check if reset is needed
        if (this.shouldResetMinute(key, now)) {
          await this.resetKeyMinute(key.id);
          key.requestsThisMinute = 0;
          key.status = "active";
        }
        
        if (this.shouldResetDay(key, now)) {
          await this.resetKeyDay(key.id);
          key.requestsToday = 0;
          key.status = "active";
        }

        if (key.status === "active" && key.requestsThisMinute < 15 && key.requestsToday < 1500) {
          return { ...key, key: this.decrypt(key.key) };
        }
      }

      // If all exhausted, fallback to first key (it might reset soon) or return null
      if (keys.length > 0) {
        return { ...keys[0], key: this.decrypt(keys[0].key) };
      }

      return null;
    } catch (error) {
      console.error("[KeyRotation] Error getting current key:", error);
      throw error; // Throw so the API handler catches it
    }
  }

  async incrementUsage(keyId: string) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const data = docSnap.data();
    const newMinuteCount = (data.requestsThisMinute || 0) + 1;
    const newDayCount = (data.requestsToday || 0) + 1;
    
    const updateData: any = {
      requestsThisMinute: newMinuteCount,
      requestsToday: newDayCount,
      updatedAt: new Date() // admin.firestore.Timestamp or Date works
    };

    if (newMinuteCount >= 15 || newDayCount >= 1500) {
      updateData.status = "exhausted";
    }

    await docRef.update(updateData);
  }

  async markExhausted(keyId: string) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    await docRef.update({
      status: "exhausted",
      updatedAt: new Date()
    });
  }

  private shouldResetMinute(key: ApiKeyData, now: Date): boolean {
    if (!key.lastResetMinute) return true;
    try {
      const lastReset = key.lastResetMinute.toDate ? key.lastResetMinute.toDate() : new Date(key.lastResetMinute);
      if (isNaN(lastReset.getTime())) return true;
      return now.getTime() - lastReset.getTime() > 60000;
    } catch (e) {
      return true;
    }
  }

  private shouldResetDay(key: ApiKeyData, now: Date): boolean {
    if (!key.lastResetDay) return true;
    try {
      const lastReset = key.lastResetDay.toDate ? key.lastResetDay.toDate() : new Date(key.lastResetDay);
      if (isNaN(lastReset.getTime())) return true;
      return now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
    } catch (e) {
      return true;
    }
  }

  async resetKeyMinute(keyId: string) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    await docRef.update({
      requestsThisMinute: 0,
      lastResetMinute: new Date(),
      status: "active"
    });
  }

  async resetKeyDay(keyId: string) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    await docRef.update({
      requestsToday: 0,
      lastResetDay: new Date(),
      status: "active"
    });
  }

  async resetAllKeys() {
    try {
      const keysRef = this.db.collection("apiKeys");
      const querySnapshot = await keysRef.get();
      const now = new Date();
      for (const d of querySnapshot.docs) {
        const data = d.data();
        const lastMin = data.lastResetMinute?.toDate ? data.lastResetMinute.toDate() : (data.lastResetMinute ? new Date(data.lastResetMinute) : null);
        const lastDay = data.lastResetDay?.toDate ? data.lastResetDay.toDate() : (data.lastResetDay ? new Date(data.lastResetDay) : null);
        
        const update: any = {};
        if (!lastMin || (now.getTime() - lastMin.getTime() > 60000)) {
          update.requestsThisMinute = 0;
          update.lastResetMinute = now;
          update.status = "active";
        }
        if (!lastDay || (now.getDate() !== lastDay.getDate() || now.getMonth() !== lastDay.getMonth() || now.getFullYear() !== lastDay.getFullYear())) {
          update.requestsToday = 0;
          update.lastResetDay = now;
          update.status = "active";
        }

        if (Object.keys(update).length > 0) {
          console.log(`[KeyRotation] Resetting key: ${d.id}`);
          await d.ref.update(update);
        }
      }
    } catch (error: any) {
      console.error("[KeyRotation] Critical error in resetAllKeys:", error.message, error.stack);
      throw error;
    }
  }
}
