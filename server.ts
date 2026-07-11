import express from "express";
import path from "path";
import dotenv from "dotenv";
import admin, { adminDb } from "./src/lib/firebase-admin.js";
import { aggregateDailyStats } from "./src/lib/analytics-aggregator.js";
import { processEmailQueue, processManualEmailQueue } from "./src/lib/email-campaign-service.js";
import { requireAdminAuth } from "./src/lib/email-auth.js";
import campaignRouter from "./api/email/campaigns/route.js";
import templateRouter from "./api/email/templates/route.js";
import recipientRouter from "./api/email/recipients/route.js";
import settingsRouter from "./api/email/settings/route.js";
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

// Email Marketing API Routes
app.use("/api/email/campaigns", campaignRouter);
app.use("/api/email/templates", templateRouter);
app.use("/api/email/recipients", recipientRouter);
app.use("/api/email/settings", settingsRouter);

// POST /api/email/send-now
app.post("/api/email/send-now", requireAdminAuth, async (req, res) => {
  try {
    const { campaignId } = req.body;
    const report = await processManualEmailQueue(50, campaignId);
    res.json({ success: true, ...report });
  } catch (error: any) {
    console.error("[Email API] /api/email/send-now manual send failed:", error);
    res.status(500).json({ error: "Failed to process email queue manually", details: error?.message });
  }
});

/**
 * Helper to generate content with resilient retry, key rotation, and model fallback
 * If gemini-3.5-flash is unavailable or experiencing high demand, we try alternative models.
 */
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  initialKey: string;
  initialKeyId: string;
  initialKeyName: string;
}): Promise<{
  text: string;
  keyUsed: string;
  keyIdUsed: string;
  keyNameUsed: string;
  modelUsed: string;
}> {
  const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
  let currentKey = params.initialKey;
  let currentKeyId = params.initialKeyId;
  let currentKeyName = params.initialKeyName;
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI Resilient] Requesting model: ${model}, attempt: ${attempt} using key: ${currentKeyName}`);
        const ai = new GoogleGenAI({
          apiKey: currentKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            }
          }
        });

        const response = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config
        });

        if (response.text) {
          return {
            text: response.text,
            keyUsed: currentKey,
            keyIdUsed: currentKeyId,
            keyNameUsed: currentKeyName,
            modelUsed: model
          };
        } else {
          throw new Error("Empty response from Gemini");
        }
      } catch (err: any) {
        lastError = err;
        const errMessage = err?.message || String(err);
        const status = err?.status || (errMessage.includes("429") ? 429 : errMessage.includes("503") ? 503 : 500);
        console.warn(`[AI Resilient] Failure using model: ${model} with key: ${currentKeyName}. Status: ${status}, Message: ${errMessage}`);
        
        if (keyRotation && currentKeyId !== "env_key") {
          try {
            if (status === 429) {
              console.log(`[AI Resilient] Mark key ${currentKeyId} as exhausted`);
              await keyRotation.markAsExhausted(currentKeyId).catch((e: any) => console.error(e));
            }
            const activeKey = await keyRotation.getRotatedKey().catch(() => null);
            if (activeKey) {
              currentKey = activeKey.key;
              currentKeyId = activeKey.id;
              currentKeyName = activeKey.name;
              console.log(`[AI Resilient] Rotated to key: ${currentKeyName} (${currentKeyId})`);
            }
          } catch (rotateErr) {
            console.error(`[AI Resilient] Key rotation lookup failure:`, rotateErr);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError || new Error("All fallback models exhausted and failed");
}

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
    const genResult = await generateContentWithFallback({
      contents: contents,
      config: {
        systemInstruction: BASE_SYSTEM_INSTRUCTION + "\n\n" + (context || ""),
        responseMimeType: "application/json",
      },
      initialKey: keyToUse,
      initialKeyId: keyId,
      initialKeyName: keyName,
    });

    const responseText = genResult.text;
    keyToUse = genResult.keyUsed;
    keyId = genResult.keyIdUsed;
    keyName = genResult.keyNameUsed;

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

// Vercel-style Cron endpoint for email marketing campaigns dispatch
app.get("/api/cron/send-emails", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const report = await processEmailQueue();
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("[Cron Send-Emails] Execution failed:", error);
    res.status(500).json({ error: "Email processing queue failed", details: error?.message });
  }
});

/**
 * Public Visitor Counter Endpoint
 * Handles incrementing unique visits and retrieving the count via Admin SDK
 * Bypasses restrictive client-side firestore.rules
 */
app.post("/api/visitors", async (req, res) => {
  const { targetUserId, isNewVisit } = req.body;
  if (!targetUserId) return res.status(400).json({ error: "Missing targetUserId" });
  if (!adminDb) return res.status(503).json({ error: "Firebase Admin DB unavailable" });

  try {
    const docRef = adminDb.collection("portfolioStats").doc(`visits_${targetUserId}`);
    
    if (isNewVisit) {
      await docRef.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });
    }
    
    const snap = await docRef.get();
    res.json({ count: snap.data()?.count || (isNewVisit ? 1 : 0) });
  } catch (error: any) {
    console.error("[Visitors API] Error updating/fetching count:", error);
    res.status(500).json({ error: "Failed to fetch visitor count" });
  }
});

async function sendMailHelper(to: string, subject: string, text: string, html?: string) {
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
      return true;
    } catch (err) {
      console.error("[Email Service] Failed to send email via SMTP:", err);
      return false;
    }
  }
  
  console.log(`[Email Service] SMTP configuration not available. Acknowledging email to ${to} (Logged only)`);
  return false;
}

app.post("/api/send-email", async (req, res) => {
  const { to, subject, text, html } = req.body;
  const sent = await sendMailHelper(to, subject, text, html);
  if (sent) {
    res.json({ success: true, message: "Email sent" });
  } else if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    res.json({ success: true, message: "Email logged (no SMTP config)" });
  } else {
    res.status(500).json({ success: false, error: "Failed to send email" });
  }
});

/**
 * Server-side background AI Auto-Reply for contact queries
 */
app.post("/api/queries/auto-reply", async (req, res) => {
  const { queryId, userEmail, userName, subject, message } = req.body;
  const steps: string[] = [];

  const logStep = (msg: string) => {
    const formatted = `[Auto-Reply Step] ${msg}`;
    console.log(formatted);
    steps.push(msg);
  };

  logStep(`Received trigger for message ID ${queryId}, email: ${userEmail}`);

  if (!queryId || !userEmail) {
    logStep("ERROR: Missing queryId or userEmail");
    return res.status(400).json({ success: false, error: "Missing queryId or userEmail", steps });
  }

  if (!adminDb) {
    logStep("ERROR: No Firestore database (adminDb is null)");
    return res.status(500).json({ success: false, error: "No Database connection", steps });
  }

  try {
    // 1. Fetch settings from Firestore
    let settings: any = null;
    logStep("Fetching settings document with ID 'global' from 'settings' collection");
    const settingsDoc = await adminDb.collection("settings").doc("global").get().catch((err: any) => {
      logStep(`WARN/ERROR: Failed to fetch settings from Firestore: ${err?.message || err}`);
      return null;
    });

    if (settingsDoc && settingsDoc.exists) {
      settings = settingsDoc.data();
      logStep(`Successfully fetched settings (enableAutoReply=${settings?.enableAutoReply})`);
    }

    // Fallback 1: If 'global' settings missing or enableAutoReply is undefined, search settings collection for master admin profile
    if (!settings || settings.enableAutoReply === undefined) {
      logStep("WARN: 'global' settings missing or enableAutoReply is undefined. Searching 'settings' collection for master admin profile email 'muhammadbilalrasheed78@gmail.com'...");
      const settingsQuery = await adminDb.collection("settings").where("email", "==", "muhammadbilalrasheed78@gmail.com").get().catch((err: any) => {
        logStep(`WARN: Failed to search settings by admin email: ${err?.message || err}`);
        return null;
      });

      if (settingsQuery && !settingsQuery.empty) {
        settings = settingsQuery.docs[0].data();
        logStep(`SUCCESS Fallback 1: Found master admin settings document with enableAutoReply=${settings?.enableAutoReply}`);
      }
    }

    // Fallback 2: General first settings document fallback (same as client-side)
    if (!settings || settings.enableAutoReply === undefined) {
      logStep("WARN: Still no valid settings. Checking for ANY settings document in the collection...");
      const allSettingsSnap = await adminDb.collection("settings").limit(5).get().catch((err: any) => {
        logStep(`WARN: Failed to list settings table: ${err?.message || err}`);
        return null;
      });

      if (allSettingsSnap && !allSettingsSnap.empty) {
        const docWithAutoReply = allSettingsSnap.docs.find(d => d.data()?.enableAutoReply !== undefined);
        const chosenDoc = docWithAutoReply || allSettingsSnap.docs[0];
        settings = chosenDoc.data();
        logStep(`SUCCESS Fallback 2: Found settings document (ID: ${chosenDoc.id}) with enableAutoReply=${settings?.enableAutoReply}`);
      }
    }

    const enableAutoReply = settings?.enableAutoReply ?? false;
    logStep(`Evaluated finalized auto-reply state: enableAutoReply=${enableAutoReply}`);
    if (!enableAutoReply) {
      logStep("ABORTING: Auto-reply is disabled in Settings. Skipping AI reply.");
      return res.json({ success: true, message: "Auto-reply is disabled", steps });
    }

    // 2. Fetch or rotate the Gemini Key
    logStep("Checking for Gemini API Key configuration...");
    let keyToUse = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let keyId = "env_key";
    let keyName = "Default Key";
    if (keyToUse) {
      logStep("Found standard Gemini key in environment variables");
    }

    if (keyRotation) {
      logStep("Attempting to get key from Key Rotation Service...");
      const activeKey = await keyRotation.getRotatedKey().catch((err: any) => {
        logStep(`WARN/ERROR: Key rotation failed: ${err?.message || err}`);
        return null;
      });
      if (activeKey && activeKey.key) {
        keyToUse = activeKey.key;
        keyId = activeKey.id;
        keyName = activeKey.name;
        logStep(`Key rotation success! Using rotated key: ${activeKey.name || activeKey.id}`);
      } else {
        logStep("Key rotation did not return a valid key. Falling back to environment variables.");
      }
    }

    if (!keyToUse) {
      logStep("ERROR: No Gemini API Key found in either environment variables or rotation service.");
      return res.status(500).json({ success: false, error: "No Gemini Key Configured", steps });
    }

    const instruction = settings?.autoReplyInstruction || 
      "You are an automated AI assistant for Bilal Rasheed. Write a brief, polite, and professional email response acknowledging the user's inquiry, letting them know Bilal will review it shortly, and providing a preliminary helpful thought based on their message text.";

    logStep("Invoking Gemini with robust fallback model support...");
    const genResult = await generateContentWithFallback({
      contents: [
        {
          role: "user",
          parts: [{ text: `User Name: ${userName || "Inquirer"}\nUser Email: ${userEmail}\nSubject: ${subject || "No Subject"}\nMessage:\n${message || ""}` }]
        }
      ],
      config: {
        systemInstruction: instruction
      },
      initialKey: keyToUse,
      initialKeyId: keyId,
      initialKeyName: keyName
    });

    const replyText = genResult.text.trim();
    logStep(`Gemini generation succeeded (model used: ${genResult.modelUsed})! Draft length: ${replyText.length} characters.`);

    // 4. Send email directly to User's email
    const replySubject = `Re: [Automated Reply] Your Inquiry to Bilal Rasheed`;
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="padding-bottom: 20px; border-bottom: 2px solid #edf2f7; margin-bottom: 25px;">
          <h2 style="color: #2b6cb0; margin: 0; font-size: 22px;">Message Acknowledged</h2>
          <p style="color: #718096; margin: 5px 0 0 0; font-size: 13px;">Automated Assistance from Muhammad Bilal Rasheed's Portfolio</p>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Hello ${userName || "there"},</p>
        <p style="font-size: 15px; line-height: 1.6; color: #4a5568;">Thank you for getting in touch. Here is an automated acknowledgment and a quick helpful thought based on your message detail:</p>
        
        <div style="background-color: #f7fafc; border-left: 4px solid #3182ce; padding: 20px; border-radius: 6px; margin: 25px 0; font-size: 14px; line-height: 1.6; font-style: italic; white-space: pre-wrap; color: #2d3748;">
${replyText}
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; color: #4a5568;">Bilal will review your inquiry and connect with you shortly.</p>
        
        <div style="border-top: 2px solid #edf2f7; margin-top: 30px; padding-top: 20px; font-size: 11px; color: #a0aec0; text-align: center; line-height: 1.4;">
          <p style="margin: 0;">This email was sent automatically to acknowledge receipt of your message.</p>
          <p style="margin: 4px 0 0 0;">Muhammad Bilal Rasheed • Developer Portfolio</p>
        </div>
      </div>
    `;

    logStep(`Dispatching email dynamically to ${userEmail}...`);
    const sent = await sendMailHelper(userEmail, replySubject, replyText, htmlBody);
    if (sent) {
      logStep("Email dispatched successfully via NodeMailer SMTP.");
    } else {
      logStep("WARN: Email log-only mode (either SMTP credentials not configured, or SMTP dispatch failed).");
    }

    // 5. Update the query document inside Firestore messages collection
    const autoReplyStatus = sent ? "sent" : "logged";
    logStep(`Updating Firestore contactMessages document with ID ${queryId} status: ${autoReplyStatus}...`);
    await adminDb.collection("contactMessages").doc(queryId).update({
      status: "replied",
      repliedAt: admin.firestore.FieldValue.serverTimestamp(),
      autoReplyText: replyText,
      aiReplyText: replyText,
      autoRepliedAt: admin.firestore.FieldValue.serverTimestamp(),
      aiRepliedAt: admin.firestore.FieldValue.serverTimestamp(),
      autoReplyStatus: autoReplyStatus
    });

    logStep("Firestore document successfully updated! Process complete.");
    return res.json({
      success: true,
      message: "Auto-reply processed successfully",
      steps,
      replyText,
      emailStatus: autoReplyStatus
    });

  } catch (error: any) {
    logStep(`FATAL ERROR: ${error?.message || error}`);
    console.error("[Auto-Reply] Fatal Error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Internal error during auto-reply generation",
      steps
    });
  }
});

/**
 * Server-side AI Draft generation for contact queries (manually reviewed by Admin)
 */
app.post("/api/queries/draft-ai", async (req, res) => {
  const { subject, message, userName, userEmail } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: "Missing user message to draft reply for." });
  }

  try {
    let keyToUse = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let keyId = "env_key";
    let keyName = "Default Key";
    if (keyRotation) {
      const activeKey = await keyRotation.getRotatedKey().catch(() => null);
      if (activeKey && activeKey.key) {
        keyToUse = activeKey.key;
        keyId = activeKey.id;
        keyName = activeKey.name;
      }
    }

    if (!keyToUse) {
      return res.status(500).json({ success: false, error: "No Gemini Key Configured" });
    }

    const systemInstruction = `You are Muhammad Bilal Rasheed, a professional developer. Write a highly professional, polite, and contextual email response replying directly to the user's inquiry on your portfolio website.
Guidelines:
1. Write from Bilal's first-person perspective (using "I", "my").
2. Be professional, friendly, and helpful.
3. Do NOT include any email subject line, headers, salutations like "To:", or footer / sign-offs containing generic bracketed placeholders like "[Your Name]".
4. Just return the actual paragraph body of the email reply. Keep it ready to be edited.
5. Close the email with a professional sign-off as "Best regards, Muhammad Bilal Rasheed".`;

    const genResult = await generateContentWithFallback({
      contents: [
        {
          role: "user",
          parts: [{ text: `Inquirer's Name: ${userName || "Inquirer"}\nInquirer's Email: ${userEmail || "No Email"}\nSubject: ${subject || "No Subject"}\nMessage:\n${message}` }]
        }
      ],
      config: {
        systemInstruction: systemInstruction
      },
      initialKey: keyToUse,
      initialKeyId: keyId,
      initialKeyName: keyName
    });

    return res.json({
      success: true,
      draft: genResult.text.trim()
    });
  } catch (error: any) {
    console.error("[Draft AI Error]:", error);
    return res.status(500).json({ success: false, error: error?.message || "Internal server error during draft generation" });
  }
});

/**
 * Diagnostic Endpoint: SMTP Verification (Handshake and Auth check)
 */
app.get("/api/admin/diagnose-smtp", async (req, res) => {
  const steps: string[] = [];
  const log = (msg: string) => { steps.push(msg); console.log(`[SMTP Diagnostic] ${msg}`); };
  
  log("Starting SMTP Connection Diagnostic Check...");
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  log(`SMTP Host: ${smtpHost}`);
  log(`SMTP Port: ${smtpPort}`);
  log(`SMTP User length: ${smtpUser ? smtpUser.length : 0} characters`);
  log(`SMTP Password length: ${smtpPass ? smtpPass.length : 0} characters`);

  if (!smtpUser || !smtpPass) {
    log("ERROR: SMTP_USER or SMTP_PASS environment variables are missing.");
    return res.json({ success: false, error: "Missing env credentials", steps });
  }

  try {
    const nodemailer = await import("nodemailer");
    const port = parseInt(smtpPort);
    log(`Creating transporter connection setting port=${port}, secure=${port === 465}...`);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000
    });

    log("Verifying SMTP server handshake/connection...");
    await transporter.verify();
    log("SUCCESS: SMTP server connection verified and authenticated successfully!");
    
    return res.json({ success: true, steps });
  } catch (err: any) {
    log(`FATAL DIAGNOSTIC ERROR: ${err?.message || err}`);
    return res.json({ success: false, error: err?.message || String(err), steps });
  }
});

/**
 * Diagnostic Endpoint: Draft Generation Test (AI model connection check)
 */
app.get("/api/admin/test-auto-reply", async (req, res) => {
  const steps: string[] = [];
  const log = (msg: string) => { steps.push(msg); console.log(`[Test Auto-Reply] ${msg}`); };
  log("Starting Gemini Auto-Reply generation test...");
  
  let keyToUse = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  let keyId = "env_key";
  let keyName = "Default Key";

  if (keyToUse) {
    log("Found standard Gemini key in environment variables");
  }

  if (keyRotation) {
    log("Querying KeyRotationService...");
    const activeKey = await keyRotation.getRotatedKey().catch((err: any) => {
      log(`Key rotation warning: ${err?.message || err}`);
      return null;
    });
    if (activeKey && activeKey.key) {
      keyToUse = activeKey.key;
      keyId = activeKey.id;
      keyName = activeKey.name;
      log(`Rotated key detected: ${activeKey.name || activeKey.id}`);
    }
  }

  if (!keyToUse) {
    log("ERROR: No Gemini key configured.");
    return res.json({ success: false, error: "No Gemini Key found", steps });
  }

  try {
    log("Invoking Gemini with robust fallback model support...");
    const genResult = await generateContentWithFallback({
      contents: "This is an automatic mailer diagnostic test. Please reply with: 'Success: Gemini integration is active!' and nothing else.",
      initialKey: keyToUse,
      initialKeyId: keyId,
      initialKeyName: keyName
    });

    log(`SUCCESS: Gemini response generated successfully (model: ${genResult.modelUsed}): ${genResult.text.trim()}`);
    return res.json({ success: true, steps, text: genResult.text.trim(), modelUsed: genResult.modelUsed });
  } catch (err: any) {
    log(`FATAL ERROR: ${err?.message || err}`);
    return res.json({ success: false, error: err?.message || String(err), steps });
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
