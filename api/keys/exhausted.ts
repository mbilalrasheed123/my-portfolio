import { adminDb } from '../../src/lib/firebase-admin.js';
import { KeyRotationService } from '../../src/lib/KeyRotationService.js';

const keyRotation = new KeyRotationService(adminDb, process.env.API_KEY_ENCRYPTION_SECRET || "default-secret-change-me");

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;
  if (!id || id === "env_key" || !keyRotation) return res.json({ success: true });
  
  try {
    await keyRotation.markExhausted(id);
    res.json({ success: true });
  } catch (error) {
    console.error("[API] Exhausted error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
