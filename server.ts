import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin, { adminDb } from "./src/lib/firebase-admin.js";
import { KeyRotationService } from "./src/lib/KeyRotationService.js";
import { aggregateDailyStats } from "./src/lib/analytics-aggregator.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Services
let keyRotation: KeyRotationService | null = null;
try {
  keyRotation = new KeyRotationService(adminDb, process.env.API_KEY_ENCRYPTION_SECRET || "default-secret-change-me");
  console.log("[Server] KeyRotationService initialized.");
} catch (e) {
  console.error("[Server] Failed to initialize KeyRotationService:", e);
}

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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

// Key Rotation Endpoints (For Frontend Use)
app.get("/api/keys/rotate", async (req, res) => {
  console.log(`[Server] Received key rotation request. URL: ${req.url}`);
  
  if (!keyRotation) {
    console.error("[Server] KeyRotationService is null/undefined.");
    return res.status(503).json({ 
      error: "Key Rotation service unavailable", 
      details: "Service failed to initialize during server startup."
    });
  }
  
  try {
    console.log("[Server] Calling keyRotation.getCurrentKey()...");
    let keyData = await keyRotation.getCurrentKey();
    
    if (keyData && keyData.key) {
      console.log(`[Server] Returning key from Firestore: ${keyData.id}`);
      return res.json({ id: keyData.id, key: keyData.key });
    }

    console.log("[Server] KeyRotation returned null, trying fallback...");

    // Fallback to environment keys if no keys in DB
    const envKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (envKey) {
      console.log(`[Server] Falling back to environment variable. Key length: ${envKey.length}`);
      return res.json({ id: "env_key", key: envKey });
    }

    console.warn("[Server] No active keys available in DB or Environment.");
    return res.status(404).json({ 
      error: "No active keys available", 
      details: "Firestore 'apiKeys' is empty or keys are inactive, AND GEMINI_API_KEY env var is missing on Vercel."
    });
  } catch (error: any) {
    console.error("[Server] Critical error in /api/keys/rotate:", error);
    return res.status(500).json({ 
      error: "Internal server error during key retrieval",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

app.post("/api/keys/usage", async (req, res) => {
  const { id } = req.body;
  if (!id || id === "env_key" || !keyRotation) return res.json({ success: true });
  await keyRotation.incrementUsage(id);
  res.json({ success: true });
});

app.post("/api/keys/exhausted", async (req, res) => {
  const { id } = req.body;
  if (!id || id === "env_key" || !keyRotation) return res.json({ success: true });
  await keyRotation.markExhausted(id);
  res.json({ success: true });
});

// Key Encryption Helper (For Admin)
app.post("/api/admin/encrypt-key", (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "Key required" });
  if (!keyRotation) return res.status(503).json({ error: "Encryption service unavailable" });
  const encrypted = keyRotation.encrypt(key);
  res.json({ encrypted });
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
