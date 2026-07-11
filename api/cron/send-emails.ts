import { processEmailQueue } from "../../src/lib/email-campaign-service.js";

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const report = await processEmailQueue();
    res.status(200).json({ success: true, report });
  } catch (error: any) {
    console.error("[Vercel Cron Send-Emails] Exception:", error);
    res.status(500).json({ error: "Email processing queue failed", details: error?.message });
  }
}
