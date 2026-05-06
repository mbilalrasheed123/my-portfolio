import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { decryptKey } from './cryptoUtils.js';

export interface ApiKeyDoc {
  id: string;
  name: string;
  key: string;
  quota: {
    rpmUsed: number;
    rpdUsed: number;
    lastUsed: Timestamp;
  };
  status: 'active' | 'exhausted' | 'disabled';
  priority: number;
}

export class KeyRotationService {
  private db: any;
  private secret: string;

  constructor(db: any, secret: string) {
    this.db = db;
    this.secret = secret;
  }

  /**
   * Selection Logic: Serverless optimized with on-the-fly resets.
   */
  async getRotatedKey(): Promise<{ id: string; key: string } | null> {
    try {
      const keysRef = this.db.collection('apiKeys');
      // Fetch all active keys
      const snapshot = await keysRef
        .where('status', '==', 'active')
        .get();

      if (snapshot.empty) return null;

      // Sort in-memory by priority to avoid Firestore index requirement
      const docs = snapshot.docs.sort((a: any, b: any) => {
        const priorityA = a.data().priority || 0;
        const priorityB = b.data().priority || 0;
        return priorityA - priorityB;
      });

      const now = Date.now();

      for (const doc of docs) {
        const data = doc.data() as ApiKeyDoc;
        
        // Defensive check: ensure quota exists
        if (!data.quota || !data.quota.lastUsed) {
          // Initialize/Reset if missing
          const defaultLastUsed = new Date(0); // Epoch start
          const currentRpm = 0;
          const currentRpd = 0;
          
          await doc.ref.update({
            'quota.rpmUsed': FieldValue.increment(1),
            'quota.rpdUsed': FieldValue.increment(1),
            'quota.lastUsed': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          return {
            id: doc.id,
            key: decryptKey(data.key, this.secret)
          };
        }

        const lastUsedDate = data.quota.lastUsed.toDate().getTime();
        
        let updatePayload: any = {};
        let currentRpm = data.quota.rpmUsed || 0;
        let currentRpd = data.quota.rpdUsed || 0;

        // 1. On-the-fly Self-Healing Logic
        // Reset RPM if > 60s
        if (now - lastUsedDate > 60000) {
          updatePayload['quota.rpmUsed'] = 0;
          currentRpm = 0;
        }

        // Reset RPD if > 24h
        if (now - lastUsedDate > 86400000) {
          updatePayload['quota.rpdUsed'] = 0;
          currentRpd = 0;
        }

        // 2. Quota Check (Standard Gemini Free Tier: 15 RPM, 1500 RPD)
        if (currentRpm < 15 && currentRpd < 1500) {
          // Atomic Update
          await doc.ref.update({
            ...updatePayload,
            'quota.rpmUsed': FieldValue.increment(1),
            'quota.rpdUsed': FieldValue.increment(1),
            'quota.lastUsed': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          return {
            id: doc.id,
            key: decryptKey(data.key, this.secret)
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[KeyRotationService] Error rotating key:', error);
      return null;
    }
  }

  /**
   * Explicitly mark a key as exhausted (e.g., if AI returns 429 even though we thought we had quota)
   */
  async markAsExhausted(keyId: string): Promise<void> {
    try {
      await this.db.collection('apiKeys').doc(keyId).update({
        status: 'exhausted',
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('[KeyRotationService] Error marking key as exhausted:', error);
    }
  }

  /**
   * Reset usage for a key (admin action)
   */
  async resetQuota(keyId: string): Promise<void> {
    try {
      await this.db.collection('apiKeys').doc(keyId).update({
        'quota.rpmUsed': 0,
        'quota.rpdUsed': 0,
        'quota.lastUsed': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('[KeyRotationService] Error resetting quota:', error);
    }
  }
}
