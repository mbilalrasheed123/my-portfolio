import { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from '../../src/lib/firebase-admin';
import { KeyRotationService } from '../../src/lib/KeyRotationService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const keyRotation = new KeyRotationService(
      adminDb, 
      process.env.API_KEY_ENCRYPTION_SECRET || "default-secret-change-me"
    );

    let keyData = await keyRotation.getCurrentKey();
    
    // Fallback to process.env.GEMINI_API_KEY if no keys in DB
    if (!keyData && process.env.GEMINI_API_KEY) {
      console.log("[API Rotator] No DB keys found, using environment fallback.");
      return res.status(200).json({ id: "env_key", key: process.env.GEMINI_API_KEY });
    }

    if (!keyData) {
      console.error("[API Rotator] All keys exhausted and no fallback available.");
      return res.status(404).json({ error: "No active keys available" });
    }
    
    return res.status(200).json({ id: keyData.id, key: keyData.key });
  } catch (error: any) {
    console.error("[API Rotator] Critical Error:", error.message, error.stack);
    return res.status(500).json({ 
      error: "Internal server error", 
      details: error.message 
    });
  }
}
