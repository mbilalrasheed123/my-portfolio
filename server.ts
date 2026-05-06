import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin, { adminDb } from "./src/lib/firebase-admin.js";
import { aggregateDailyStats } from "./src/lib/analytics-aggregator.js";
import { KeyRotationService } from "./src/lib/KeyRotationService.js";
import { encryptKey } from "./src/lib/cryptoUtils.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Key Rotation Service
const keyRotationSecret = process.env.API_KEY_ENCRYPTION_SECRET || 'gemini-key-rotation-secret-39281';
const keyRotation = adminDb ? new KeyRotationService(adminDb, keyRotationSecret) : null;

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Key Rotation Endpoint
 */
app.get("/api/keys/rotate", async (req, res) => {
  if (!keyRotation) {
    return res.status(503).json({ error: "Key rotation service unavailable" });
  }

  try {
    const keyData = await keyRotation.getRotatedKey();
    if (keyData) {
      res.json(keyData);
    } else {
      // Fallback to environment key if no keys in DB
      const envKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (envKey) {
        res.json({ id: 'env_key', key: envKey });
      } else {
        res.status(404).json({ error: "No active API keys available" });
      }
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to rotate key" });
  }
});

/**
 * Mark Key as Exhausted (429 feedback)
 */
app.post("/api/keys/exhausted", async (req, res) => {
  const { id } = req.body;
  if (!id || id === 'env_key' || !keyRotation) {
    return res.json({ success: true });
  }

  try {
    await keyRotation.markAsExhausted(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark key as exhausted" });
  }
});

/**
 * Encryption Helper for Admin (Server-side Only)
 */
app.post("/api/admin/encrypt-key", (req, res) => {
  const { key } = req.body;
  // This route should ideally be protected by admin auth middleware
  if (!key) return res.status(400).json({ error: "Key required" });
  
  try {
    const encrypted = encryptKey(key, keyRotationSecret);
    res.json({ encrypted });
  } catch (error) {
    res.status(500).json({ error: "Encryption failed" });
  }
});

// Vercel-style Cron endpoint for aggregation
app.get("/api/cron/aggregate-analytics", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await aggregateDailyStats();
    res.json({ success: true, message: "Aggregation completed" });
  } catch (error) {
    res.status(500).json({ error: "Aggregation failed" });
  }
});

app.post("/api/send-email", async (req, res) => {
  const { to, subject, text, html } = req.body;
  
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const port = parseInt(smtpPort || "587");
      const transporter = nodemailer.createTransport({
        host: smtpHost || "smtp.gmail.com",
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
        from: `"Portfolio Notification" <${smtpUser}>`,
        to,
        subject,
        text,
        html,
      });
      return res.json({ success: true, message: "Email sent" });
    } catch (error) {
      console.error(`[Email Service] Failed to send email:`, error);
      return res.status(500).json({ success: false, error: "Failed to send email" });
    }
  } else {
    return res.json({ success: true, message: "Email logged (no SMTP config)" });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite();

export default app;
