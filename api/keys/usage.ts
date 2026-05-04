import { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from '../../src/lib/firebase-admin';
import { KeyRotationService } from '../../src/lib/KeyRotationService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.body;
    if (!id || id === "env_key") return res.status(200).json({ success: true });

    const keyRotation = new KeyRotationService(
      adminDb, 
      process.env.API_KEY_ENCRYPTION_SECRET || "default-secret-change-me"
    );

    await keyRotation.incrementUsage(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[API Usage] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
