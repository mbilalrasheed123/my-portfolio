import CryptoJS from "crypto-js";

export class KeyRotationService {
  constructor(db, secret) {
    this.db = db;
    this.secret = secret;
  }

  decrypt(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.secret);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  encrypt(text) {
    return CryptoJS.AES.encrypt(text, this.secret).toString();
  }

  async getCurrentKey() {
    try {
      const keysRef = this.db.collection("apiKeys");
      const querySnapshot = await keysRef.orderBy("priority", "asc").get();
      
      const now = new Date();
      const keys = [];
      
      querySnapshot.forEach((doc) => {
        keys.push({ id: doc.id, ...doc.data() });
      });

      for (const key of keys) {
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

        if (key.status === "active" && (key.requestsThisMinute || 0) < 15 && (key.requestsToday || 0) < 1500) {
          return { ...key, key: this.decrypt(key.key) };
        }
      }

      if (keys.length > 0) {
        return { ...keys[0], key: this.decrypt(keys[0].key) };
      }

      return null;
    } catch (error) {
      console.error("[KeyRotation] Error getting current key:", error);
      return null;
    }
  }

  async incrementUsage(keyId) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const data = docSnap.data();
    const newMinuteCount = (data.requestsThisMinute || 0) + 1;
    const newDayCount = (data.requestsToday || 0) + 1;
    
    const updateData = {
      requestsThisMinute: newMinuteCount,
      requestsToday: newDayCount,
      updatedAt: new Date()
    };

    if (newMinuteCount >= 15 || newDayCount >= 1500) {
      updateData.status = "exhausted";
    }

    await docRef.update(updateData);
  }

  async markExhausted(keyId) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    await docRef.update({
      status: "exhausted",
      updatedAt: new Date()
    });
  }

  shouldResetMinute(key, now) {
    if (!key.lastResetMinute) return true;
    const lastReset = key.lastResetMinute.toDate ? key.lastResetMinute.toDate() : new Date(key.lastResetMinute);
    return now.getTime() - lastReset.getTime() > 60000;
  }

  shouldResetDay(key, now) {
    if (!key.lastResetDay) return true;
    const lastReset = key.lastResetDay.toDate ? key.lastResetDay.toDate() : new Date(key.lastResetDay);
    return now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
  }

  async resetKeyMinute(keyId) {
    const docRef = this.db.collection("apiKeys").doc(keyId);
    await docRef.update({
      requestsThisMinute: 0,
      lastResetMinute: new Date(),
      status: "active"
    });
  }

  async resetKeyDay(keyId) {
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
        
        const update = {};
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
    } catch (error) {
      console.error("[KeyRotation] Critical error in resetAllKeys:", error.message);
      throw error;
    }
  }
}
