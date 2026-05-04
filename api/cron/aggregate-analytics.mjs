import { aggregateDailyStats } from '../../src/lib/analytics-aggregator.mjs';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const stats = await aggregateDailyStats();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({ error: 'Aggregation failed' });
  }
}
