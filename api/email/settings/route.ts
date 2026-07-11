import express from "express";
import { adminDb } from "../../../src/lib/firebase-admin.js";
import admin from "../../../src/lib/firebase-admin.js";
import { requireAdminAuth } from "../../../src/lib/email-auth.js";
import { getEmailSettings, processEmailQueue } from "../../../src/lib/email-campaign-service.js";
import nodemailer from "nodemailer";

const router = express.Router();

// Apply superadmin auth middleware to all settings and queue routes
router.use(requireAdminAuth as express.RequestHandler);

/**
 * GET /api/email/settings
 * Fetch current email settings
 */
router.get("/", async (req, res) => {
  try {
    const settings = await getEmailSettings();
    res.json(settings);
  } catch (error: any) {
    console.error("[Settings API] Error fetching email settings:", error);
    res.status(500).json({ error: "Failed to fetch email settings", details: error?.message });
  }
});

/**
 * PUT /api/email/settings
 * Update email settings (dailyLimit, batchSize, autoPause)
 */
router.put("/", async (req, res) => {
  const { dailyLimit, batchSize, autoPause } = req.body;

  if (dailyLimit === undefined || batchSize === undefined) {
    return res.status(400).json({ error: "dailyLimit and batchSize are required" });
  }

  const limitNum = parseInt(dailyLimit);
  const batchNum = parseInt(batchSize);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: "Daily sending limit must be between 1 and 100 for integrity." });
  }

  if (isNaN(batchNum) || batchNum < 1 || batchNum > 5) {
    return res.status(400).json({ error: "Batch size must be between 1 and 5 to prevent script execution timeouts." });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const settingsRef = adminDb.collection("emailSettings").doc("global");
    const docSnap = await settingsRef.get();
    
    const existing = docSnap.exists ? docSnap.data() : {};

    const payload = {
      ...existing,
      dailyLimit: limitNum,
      batchSize: batchNum,
      autoPause: autoPause ?? true,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    await settingsRef.set(payload, { merge: true });
    res.json({ success: true, settings: payload });
  } catch (error: any) {
    console.error("[Settings API] Error updating settings:", error);
    res.status(500).json({ error: "Failed to update email settings", details: error?.message });
  }
});

/**
 * GET /api/email/settings/queue-status
 * Shows count of pending/sent emails, active campaigns, and daily log details.
 */
router.get("/queue-status", async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    // 1. Get total pending recipients across all campaigns
    const pendingSnap = await adminDb.collection("campaignRecipients")
      .where("status", "==", "pending")
      .get();
    
    // 2. Get active campaigns
    const activeCampaignsSnap = await adminDb.collection("campaigns")
      .where("status", "==", "active")
      .get();
    
    // 3. Get recent logs (last 50)
    const logsSnap = await adminDb.collection("emailLogs")
      .orderBy("sentAt", "desc")
      .limit(50)
      .get();
    
    const recentLogs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const settings = await getEmailSettings();

    res.json({
      success: true,
      pendingCount: pendingSnap.size,
      activeCampaignsCount: activeCampaignsSnap.size,
      emailsSentToday: settings.emailsSentToday,
      dailyLimit: settings.dailyLimit,
      recentLogs
    });
  } catch (error: any) {
    console.error("[Settings API] Error fetching queue status:", error);
    res.status(500).json({ error: "Failed to fetch queue status", details: error?.message });
  }
});

/**
 * POST /api/email/settings/test-email
 * Sends a manual test email to verify SMTP or simulation settings.
 */
router.post("/test-email", async (req, res) => {
  const { to, subject, bodyHtml } = req.body;

  if (!to || !subject || !bodyHtml) {
    return res.status(400).json({ error: "recipient email (to), subject, and bodyHtml are required" });
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return res.json({ 
      success: true, 
      simulated: true, 
      message: `Simulation mode active (SMTP credentials are not configured). logged email to: ${to}` 
    });
  }

  try {
    const port = parseInt(smtpPort);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: port,
      secure: port === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"Portfolio Notification Test" <${smtpUser}>`,
      to,
      subject,
      html: bodyHtml,
      text: bodyHtml.replace(/<[^>]*>/g, "")
    });

    res.json({ success: true, message: "SMTP connection verified. Test email sent successfully." });
  } catch (error: any) {
    console.error("[Settings API] Test SMTP send failed:", error);
    res.status(500).json({ error: "SMTP sending failed. Verify your SMTP credentials.", details: error?.message });
  }
});

/**
 * POST /api/email/settings/trigger-queue
 * Force manual triggering of the queue processor (similar to Cron run)
 */
router.post("/trigger-queue", async (req, res) => {
  try {
    const report = await processEmailQueue();
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("[Settings API] Manual queue process trigger failed:", error);
    res.status(500).json({ error: "Failed to process email queue", details: error?.message });
  }
});

export default router;
