import express from "express";
import path from "path";
import dotenv from "dotenv";
import admin, { adminDb } from "./src/lib/firebase-admin.js";
import { aggregateDailyStats } from "./src/lib/analytics-aggregator.js";
import { KeyRotationService } from "./src/lib/KeyRotationService.js";
import { encryptKey } from "./src/lib/cryptoUtils.js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

const BASE_SYSTEM_INSTRUCTION = `You are a professional AI assistant for **Muhammad Bilal Rasheed**. 
CORE DIRECTIVES:
1. Be Concise and professional.
2. website context: You are on Bilal's official portfolio.
3. PROACTIVE LEAD COLLECTION: If the user is interested in hiring, collect: Name, Email, Phone, Project Description.

OUTPUT FORMAT: You must output valid JSON with this schema:
{
  "reply": "your text response",
  "isLeadDetected": boolean,
  "leadInfo": { "name": "...", "email": "...", "phone": "...", "description": "..." }
}`;

// Initialize Key Rotation Service
const keyRotationSecret = process.env.API_KEY_ENCRYPTION_SECRET || 'gemini-key-rotation-secret-39281';
const keyRotation = adminDb ? new KeyRotationService(adminDb, keyRotationSecret) : null;

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Server-side Unified Fast Chat Endpoint
 */
app.post("/api/chat", async (req, res) => {
  const { 
    contents, 
    context, 
    userText, 
    sessionId, 
    userId, 
    userName, 
    isGuest, 
    messageCount, 
    messagesPerKey 
  } = req.body;

  const startTime = Date.now();

  // 1. Manage Key Rotation & Tracking on the server
  let keyToUse = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  let keyId = "env_key";
  let keyName = "Default Key";

  if (keyRotation) {
    try {
      const activeKey = await keyRotation.getRotatedKey();
      if (activeKey) {
        keyToUse = activeKey.key;
        keyId = activeKey.id;
        keyName = activeKey.name;
      }
    } catch (err) {
      console.error("[Server Chat] Key rotation failed, using fallback env key:", err);
    }
  }

  if (!keyToUse) {
    return res.status(500).json({ error: "No Gemini API key configured on server." });
  }

  const currentCount = (messageCount || 0) + 1;
  const currentMessagesPerKey = { ...(messagesPerKey || {}) };
  currentMessagesPerKey[keyId] = (currentMessagesPerKey[keyId] || 0) + 1;

  try {
    let responseText = "";
    const maxRetries = 2; // Keep low on server for snappy failover
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const ai = new GoogleGenAI({
          apiKey: keyToUse,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            }
          }
        });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: contents,
          config: {
            systemInstruction: BASE_SYSTEM_INSTRUCTION + "\n\n" + (context || ""),
            responseMimeType: "application/json",
          }
        });

        if (response.text) {
          responseText = response.text;
          break;
        } else {
          throw new Error("Empty text response from Gemini");
        }
      } catch (err: any) {
        console.error(`[Server Chat] Attempt ${attempt} failed:`, err.message);
        const is429 = err.message?.includes("429") || err.status === 429;
        
        if (is429 && keyRotation && keyId !== "env_key") {
          console.log(`[Server Chat] 429 detected, marking key ${keyId} as exhausted`);
          await keyRotation.markAsExhausted(keyId).catch(e => console.error(e));
          // Try to rotate to a new key
          const activeKey = await keyRotation.getRotatedKey().catch(() => null);
          if (activeKey) {
            keyToUse = activeKey.key;
            keyId = activeKey.id;
            keyName = activeKey.name;
          }
        }

        if (attempt === maxRetries) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const responseTime = Date.now() - startTime;

    let modelData: any;
    try {
      modelData = JSON.parse(responseText.trim());
    } catch (e) {
      modelData = { reply: responseText, isLeadDetected: false };
    }

    const modelText = modelData.reply || "I'm sorry, I couldn't process that.";

    // Return the response immediately to maximize UI snappiness
    res.json({
      modelData,
      keyId,
      keyName,
      messageCount: currentCount,
      messagesPerKey: currentMessagesPerKey,
      responseTime
    });

    // Run the logging and writes completely in the background without blocking the request!
    if (adminDb) {
      (async () => {
        try {
          // 1. Update Chat Session
          const formattedMessages = contents.map((c: any) => ({
            role: c.role,
            text: c.parts[0]?.text || "",
            timestamp: new Date().toISOString()
          }));
          
          formattedMessages.push({
            role: "model",
            text: modelText,
            timestamp: new Date().toISOString()
          });

          await adminDb.collection("chatSessions").doc(sessionId).set({
            id: sessionId,
            userId: userId,
            userName: userName,
            isGuest: isGuest,
            messages: formattedMessages,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // 2. Logging Chat Message Log
          await adminDb.collection("chatMessages").add({
            sessionId: sessionId || "none",
            userMessage: userText,
            botResponse: modelText,
            apiKeyUsed: keyId,
            apiKeyName: keyName,
            messageNumberOverall: currentCount,
            messageNumberForKey: currentMessagesPerKey[keyId] || 1,
            responseTime: responseTime,
            status: "success",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          // 3. Lead generation if detected
          if (modelData.isLeadDetected && modelData.leadInfo) {
            await adminDb.collection("leads").add({
              ...modelData.leadInfo,
              userId: userId || "guest",
              chatId: sessionId || "none",
              status: "new",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        } catch (loggerErr) {
          console.error("[Server Chat] Error running background Firebase logs:", loggerErr);
        }
      })();
    }

  } catch (err: any) {
    console.error("[Server Chat] Generation Error:", err);
    res.status(500).json({ error: err.message || "Interactive generate content thread error" });

    // Save error state in background
    if (adminDb) {
      adminDb.collection("chatMessages").add({
        userMessage: userText,
        botResponse: "[ERROR]",
        status: "failed",
        errorMessage: err.message || "Fatal chatbot error",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }).catch(e => console.error("[Server Chat] Error log save failure:", e));
    }
  }
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
    const { createServer: createViteServer } = await import("vite");
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
