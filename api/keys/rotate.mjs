import { adminDb } from '../../src/lib/firebase-admin.mjs';
import { KeyRotationService } from '../../src/lib/KeyRotationService.mjs';

const keyRotation = new KeyRotationService(adminDb, process.env.API_KEY_ENCRYPTION_SECRET || "default-secret-change-me");

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!keyRotation) return res.status(503).json({ error: "Key Rotation service unavailable" });
  
  try {
    let keyData = await keyRotation.getCurrentKey();
    
    if (!keyData && process.env.GEMINI_API_KEY) {
      return res.json({ id: "env_key", key: process.env.GEMINI_API_KEY });
    }

    if (!keyData) return res.status(404).json({ error: "No active keys available" });
    
    res.json({ id: keyData.id, key: keyData.key });
  } catch (error) {
    console.error("[API] Rotate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
