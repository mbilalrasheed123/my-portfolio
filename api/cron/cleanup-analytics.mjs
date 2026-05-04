import { adminDb } from '../../src/lib/firebase-admin.mjs';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const snapshot = await adminDb.collection('analytics')
      .where('timestamp', '<', cutoffDate)
      .limit(500)
      .get();
    
    if (snapshot.empty) {
      return res.json({ deleted: 0, message: "No data to clean up" });
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    res.json({ 
      deleted: snapshot.size, 
      message: `Successfully cleaned up ${snapshot.size} old events.` 
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
}
