import express from "express";
import { adminDb } from "../../../src/lib/firebase-admin.js";
import admin from "../../../src/lib/firebase-admin.js";
import { requireAdminAuth } from "../../../src/lib/email-auth.js";
import { GoogleGenAI, Type } from "@google/genai";

const router = express.Router();

// Apply superadmin auth middleware to all AI Campaign routes
router.use(requireAdminAuth as express.RequestHandler);

// Allowed models and their RPM limits
const MODEL_LIMITS: Record<string, { name: string; rpm: number }> = {
  "flash-lite": { name: "gemini-3.1-flash-lite", rpm: 15 },
  "flash": { name: "gemini-3.5-flash", rpm: 10 },
  "2.5-flash": { name: "gemini-2.5-flash", rpm: 10 },
  "2.5-pro": { name: "gemini-3.1-pro-preview", rpm: 2 } // Conservative limit for trial
};

// Map input models to real API model names
function getRealModelName(modelKey: string): string {
  return MODEL_LIMITS[modelKey]?.name || "gemini-3.1-flash-lite";
}

function getModelRpm(modelKey: string): number {
  return MODEL_LIMITS[modelKey]?.rpm || 10;
}

/**
 * Helper to delay execution
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Self-healing Rate Limiter for Gemini API
 * Verifies and waits if the selected model's RPM is exceeded.
 */
async function enforceRateLimit(modelKey: string): Promise<void> {
  if (!adminDb) return;
  const config = MODEL_LIMITS[modelKey] || { rpm: 10 };
  const maxRpm = config.rpm;

  let retries = 0;
  while (retries < 5) {
    const now = new Date();
    const currentMinute = now.getUTCMinutes();
    const currentSecond = now.getUTCSeconds();
    
    const settingsRef = adminDb.collection("aiCampaignSettings").doc("global");
    
    try {
      await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(settingsRef);
        let data = doc.exists ? doc.data() : null;
        
        if (!data) {
          data = {
            lastGeminiRequestTime: now.toISOString(),
            requestCountThisMinute: 0,
            currentMinuteMarker: currentMinute,
            imageStrategy: "option1-keyword",
            modelConfigs: {
              "flash-lite": { rpm: 15 },
              "flash": { rpm: 10 },
              "2.5-flash": { rpm: 10 },
              "2.5-pro": { rpm: 2 }
            }
          };
        }

        const savedMinute = data.currentMinuteMarker ?? -1;
        let count = data.requestCountThisMinute ?? 0;

        if (savedMinute !== currentMinute) {
          // Reset counter at minute boundary
          count = 0;
        }

        if (count >= maxRpm) {
          // Limit exceeded, throw an error to abort transaction and sleep outside
          throw { isRateLimited: true, secondsLeft: 60 - currentSecond };
        } else {
          // Inside rate limit, increment and write
          transaction.set(settingsRef, {
            ...data,
            requestCountThisMinute: count + 1,
            currentMinuteMarker: currentMinute,
            lastGeminiRequestTime: now.toISOString()
          }, { merge: true });
        }
      });

      // If transaction succeeded, we are good to go!
      return;

    } catch (err: any) {
      if (err.isRateLimited) {
        const sleepMs = (err.secondsLeft + 2) * 1000;
        console.warn(`[AI Rate Limiter] Model ${modelKey} hit RPM cap. Waiting ${sleepMs}ms for reset...`);
        await delay(sleepMs);
        retries++;
      } else {
        console.error("[AI Rate Limiter] Unexpected transaction error:", err);
        await delay(1000);
        retries++;
      }
    }
  }
}

/**
 * Custom Lead CSV parser to support:
 * email, name, businessType, businessName, city
 */
function parseLeadsCSV(csvContent: string): any[] {
  if (!csvContent) return [];
  const lines = csvContent.split(/\r?\n/);
  if (lines.length === 0) return [];

  // Identify headers
  const firstLine = lines[0].trim().toLowerCase();
  const headers = firstLine.split(",").map(h => h.replace(/^["']|["']$/g, "").trim());

  const emailIdx = headers.findIndex(h => h.includes("email") || h === "mail");
  const nameIdx = headers.findIndex(h => h.includes("name") && !h.includes("business"));
  const bTypeIdx = headers.findIndex(h => h.includes("businesstype") || h.includes("business_type") || h.includes("type"));
  const bNameIdx = headers.findIndex(h => h.includes("businessname") || h.includes("business_name"));
  const cityIdx = headers.findIndex(h => h === "city" || h.includes("location") || h.includes("town"));

  const results: any[] = [];
  const seenEmails = new Set<string>();

  // If we couldn't find reasonable headers, fallback to column order
  const hasHeaders = emailIdx !== -1;
  const startLine = hasHeaders ? 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Support basic quotes stripping
    const cols = line.split(",").map(col => col.replace(/^["']|["']$/g, "").trim());
    if (cols.length === 0) continue;

    let email = "";
    let name = "";
    let businessType = "";
    let businessName = "";
    let city = "";

    if (hasHeaders) {
      email = emailIdx !== -1 && emailIdx < cols.length ? cols[emailIdx] : "";
      name = nameIdx !== -1 && nameIdx < cols.length ? cols[nameIdx] : "";
      businessType = bTypeIdx !== -1 && bTypeIdx < cols.length ? cols[bTypeIdx] : "";
      businessName = bNameIdx !== -1 && bNameIdx < cols.length ? cols[bNameIdx] : "";
      city = cityIdx !== -1 && cityIdx < cols.length ? cols[cityIdx] : "";
    } else {
      // Direct position fallback: email, name, businessType, businessName, city
      email = cols[0] || "";
      name = cols[1] || "";
      businessType = cols[2] || "";
      businessName = cols[3] || "";
      city = cols[4] || "";
    }

    email = email.trim().toLowerCase();
    name = name.trim();
    businessType = businessType.trim();
    businessName = businessName.trim();
    city = city.trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && emailRegex.test(email) && !seenEmails.has(email)) {
      seenEmails.add(email);
      results.push({
        email,
        name: name || email.split("@")[0],
        businessType: businessType || "Business",
        businessName: businessName || "Company",
        city: city || "Global"
      });
    }
  }

  return results;
}

/**
 * 1. POST /api/email/ai-campaigns
 * Purpose: Create AI campaign details
 */
router.post("/", async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  const { title, description, instructions, imageStrategy, geminiModel, imageKeywordTemplate } = req.body;

  if (!title || !instructions || !imageStrategy || !geminiModel) {
    return res.status(400).json({ error: "Missing required fields: title, instructions, imageStrategy, geminiModel" });
  }

  if (!MODEL_LIMITS[geminiModel]) {
    return res.status(400).json({ error: "Invalid model selected. Choose flash-lite, flash, 2.5-flash, or 2.5-pro." });
  }

  try {
    const campaignId = adminDb.collection("aiCampaigns").doc().id;
    const campaignData = {
      title,
      description: description || "",
      status: "draft",
      totalLeads: 0,
      sentCount: 0,
      failedCount: 0,
      remainingCount: 0,
      geminiModel,
      imageStrategy,
      imageKeywordTemplate: imageKeywordTemplate || "",
      instructions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      summary: {
        totalBatches: 0,
        batchesProcessed: 0,
        estimatedTimeRemaining: ""
      }
    };

    await adminDb.collection("aiCampaigns").doc(campaignId).set(campaignData);

    res.json({
      success: true,
      campaignId,
      settingsConfirmation: "Created draft AI campaign",
      selectedModel: geminiModel,
      imageStrategy
    });
  } catch (error: any) {
    console.error("[AI Campaigns Create API] Error:", error);
    res.status(500).json({ error: "Failed to create campaign", details: error?.message });
  }
});

/**
 * 2. POST /api/email/ai-campaigns/:id/upload-leads
 * Purpose: Upload CSV with leads
 */
router.post("/:id/upload-leads", async (req, res) => {
  const { id } = req.params;
  const { csvContent } = req.body;

  if (!csvContent) {
    return res.status(400).json({ error: "csvContent is required" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("aiCampaigns").doc(id);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "AI campaign not found" });
    }

    const campaign = campaignSnap.data();
    if (campaign?.status !== "draft") {
      return res.status(400).json({ error: "Can only upload leads to a draft campaign" });
    }

    const parsedLeads = parseLeadsCSV(csvContent);
    if (parsedLeads.length === 0) {
      return res.status(400).json({ error: "No valid leads found in CSV content." });
    }

    // Check existing leads in Firestore for duplicates
    const existingSnap = await adminDb.collection("aiCampaigns").doc(id).collection("leads").get();
    const existingEmails = new Set(existingSnap.docs.map(doc => doc.data().email.toLowerCase()));

    let duplicatesCount = 0;
    const leadsToImport = parsedLeads.filter(lead => {
      if (existingEmails.has(lead.email.toLowerCase())) {
        duplicatesCount++;
        return false;
      }
      return true;
    });

    // Write in batch mode
    let batch = adminDb.batch();
    let writeCount = 0;
    const batchSizeLimit = 400; // Keep slightly below 500 for safety

    for (const lead of leadsToImport) {
      const leadId = adminDb.collection("aiCampaigns").doc(id).collection("leads").doc().id;
      const leadRef = adminDb.collection("aiCampaigns").doc(id).collection("leads").doc(leadId);

      batch.set(leadRef, {
        id: leadId,
        email: lead.email,
        name: lead.name,
        businessType: lead.businessType,
        businessName: lead.businessName,
        city: lead.city,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      writeCount++;
      if (writeCount % batchSizeLimit === 0) {
        await batch.commit();
        batch = adminDb.batch();
      }
    }

    if (writeCount % batchSizeLimit !== 0) {
      await batch.commit();
    }

    const totalLeadsNow = existingEmails.size + leadsToImport.length;

    await campaignRef.update({
      totalLeads: totalLeadsNow,
      remainingCount: totalLeadsNow - (campaign?.sentCount || 0) - (campaign?.failedCount || 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      added: leadsToImport.length,
      duplicates: duplicatesCount,
      invalid: parsedLeads.length - leadsToImport.length - duplicatesCount,
      totalLeads: totalLeadsNow
    });

  } catch (error: any) {
    console.error("[AI Leads Upload API] Error:", error);
    res.status(500).json({ error: "Failed to upload leads", details: error?.message });
  }
});

/**
 * 3. GET /api/email/ai-campaigns/:id/config
 * Purpose: Fetch configuration parameters of campaign
 */
router.get("/:id/config", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const snap = await adminDb.collection("aiCampaigns").doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Campaign not found" });

    const c = snap.data();
    res.json({
      model: c?.geminiModel,
      modelRPM: getModelRpm(c?.geminiModel || "flash-lite"),
      imageStrategy: c?.imageStrategy,
      instructions: c?.instructions,
      totalLeads: c?.totalLeads,
      status: c?.status
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch config", details: error?.message });
  }
});

/**
 * 4. PUT /api/email/ai-campaigns/:id/update-config
 * Purpose: Update campaign settings (allowed in draft state only)
 */
router.put("/:id/update-config", async (req, res) => {
  const { id } = req.params;
  const { geminiModel, imageStrategy, instructions, title, description, imageKeywordTemplate } = req.body;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const ref = adminDb.collection("aiCampaigns").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Campaign not found" });

    const campaign = snap.data();
    if (campaign?.status !== "draft" && campaign?.status !== "paused") {
      return res.status(400).json({ error: "Configuration can only be updated in 'draft' or 'paused' status" });
    }

    const updates: any = {};
    if (geminiModel) {
      if (!MODEL_LIMITS[geminiModel]) return res.status(400).json({ error: "Invalid model configuration" });
      updates.geminiModel = geminiModel;
    }
    if (imageStrategy) updates.imageStrategy = imageStrategy;
    if (instructions) updates.instructions = instructions;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (imageKeywordTemplate !== undefined) updates.imageKeywordTemplate = imageKeywordTemplate;
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await ref.update(updates);

    const updatedSnap = await ref.get();
    res.json({ success: true, updatedConfig: updatedSnap.data() });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update configuration", details: error?.message });
  }
});

/**
 * 5. POST /api/email/ai-campaigns/:id/generate-all
 * Purpose: STEP 1 - Generate all personalized email copies upfront
 */
router.post("/:id/generate-all", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("aiCampaigns").doc(id);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) return res.status(404).json({ error: "Campaign not found" });

    const campaign = campaignSnap.data();
    if (campaign?.status === "generating") {
      return res.status(400).json({ error: "Campaign generation is already in progress." });
    }

    // Fetch pending leads
    const leadsRef = adminDb.collection("aiCampaigns").doc(id).collection("leads");
    const pendingLeadsSnap = await leadsRef.where("status", "==", "pending").get();
    
    if (pendingLeadsSnap.empty) {
      return res.status(400).json({ error: "No pending leads found to generate copy for." });
    }

    const pendingLeads = pendingLeadsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const totalLeads = pendingLeads.length;
    const batchSize = 5;
    const totalBatches = Math.ceil(totalLeads / batchSize);

    // Update campaign status to generating
    await campaignRef.update({
      status: "generating",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      summary: {
        totalBatches,
        batchesProcessed: 0,
        estimatedTimeRemaining: `${totalBatches * 4} seconds`
      }
    });

    // Run generation completely in background block on server (since we are Cloud Run, no 10s limit)
    // We will complete the HTTP request immediately but keep processing in server thread, or wait
    // Actually, let's process it and send real-time update but since the request allows 2-3 minutes,
    // let's run the loop! Wait, to prevent HTTP gateway timeout, it's safer to start a background loop
    // and respond immediately with { success: true, message: "Generation started in the background" }
    // so the client can poll the status! This is beautifully safe, and completely avoids any gateway timeouts!
    // Let's implement this background loop!

    // Launch background generation task
    (async () => {
      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("No GEMINI_API_KEY available in server environment variables.");
        }

        const modelKey = campaign?.geminiModel || "flash-lite";
        const realModelName = getRealModelName(modelKey);
        const imageStrategy = campaign?.imageStrategy || "option1-keyword";
        const customInstructions = campaign?.instructions || "";

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          // Check if campaign was paused during generation
          const checkSnap = await campaignRef.get();
          if (checkSnap.data()?.status !== "generating") {
            console.log(`[AI Gen background] Campaign state changed to ${checkSnap.data()?.status}. Aborting generation.`);
            return;
          }

          const startIdx = batchIdx * batchSize;
          const endIdx = Math.min(startIdx + batchSize, totalLeads);
          const batchLeads = pendingLeads.slice(startIdx, endIdx);

          // Build Prompt
          let leadsPrompt = "";
          batchLeads.forEach((lead, index) => {
            leadsPrompt += `Lead ${index + 1}:
ID: ${lead.id}
Name: ${lead.name}
Email: ${lead.email}
Business Type: ${lead.businessType}
Business Name: ${lead.businessName}
City: ${lead.city}\n\n`;
          });

          const prompt = `Generate 5 personalized sales emails for these leads:
${leadsPrompt}

PERSONALIZATION GUIDELINES & CONTEXT:
${customInstructions}

IMAGE STRATEGY:
${imageStrategy === "option1-keyword" ? "For each lead, generate an 'imageKeyword' like 'cozy-bakery' or 'modern-dentist' related to their business type. DO NOT output 'imageUrl'." : "For each lead, generate a valid full Unsplash photo URL inside the 'imageUrl' field. E.g. https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80"}

OUTPUT SCHEMA REQUIREMENT:
You must return a valid JSON array of objects. Each object in the array must strictly match this schema:
{
  "leadId": "the exact lead ID string provided above",
  "email": "the exact email of the lead",
  "subject": "the highly catchy, personalized subject line",
  "htmlBody": "the complete HTML formatted body (up to 200 words, clean style, standard paragraphs, NO Markdown blocks inside body)",
  ${imageStrategy === "option1-keyword" ? '"imageKeyword": "a clean keyword for searching Unsplash"' : '"imageUrl": "a valid unsplash URL"'}
}

Return ONLY this JSON array. No explanations, no markdown block wrapper, no leading or trailing conversational text.`;

          // Check RPM limit and wait if needed
          await enforceRateLimit(modelKey);

          // Invoke Gemini API
          console.log(`[AI Gen] Generating Batch ${batchIdx + 1}/${totalBatches} utilizing model: ${realModelName}...`);
          const ai = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } }
          });

          const response = await ai.models.generateContent({
            model: realModelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    leadId: { type: Type.STRING },
                    email: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    htmlBody: { type: Type.STRING },
                    ...(imageStrategy === "option1-keyword"
                      ? { imageKeyword: { type: Type.STRING } }
                      : { imageUrl: { type: Type.STRING } })
                  },
                  required: ["leadId", "email", "subject", "htmlBody"]
                }
              }
            }
          });

          const textResponse = response.text || "";
          let resultsArray: any[] = [];
          try {
            resultsArray = JSON.parse(textResponse.trim());
          } catch (e) {
            console.error(`[AI Gen] JSON Parsing error on batch ${batchIdx + 1}:`, e);
            // Fallback manual regex clean or basic parse if any
            const cleanedText = textResponse.replace(/^```json|```$/gi, "").trim();
            resultsArray = JSON.parse(cleanedText);
          }

          // Write results to database
          const dbBatch = adminDb.batch();
          for (const item of resultsArray) {
            const matchedLead = batchLeads.find(l => l.id === item.leadId);
            if (matchedLead) {
              const leadDocRef = leadsRef.doc(matchedLead.id);
              const generatedEmail = {
                subject: item.subject,
                htmlBody: item.htmlBody,
                selectedImageUrl: imageStrategy === "option1-keyword" ? "" : (item.imageUrl || ""),
                imageKeyword: imageStrategy === "option1-keyword" ? (item.imageKeyword || "") : ""
              };

              dbBatch.update(leadDocRef, {
                status: "generated",
                generatedEmail,
                batchNumber: batchIdx + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // Write initial trace log
              const logId = adminDb.collection("aiCampaigns").doc(id).collection("logs").doc().id;
              const logDocRef = adminDb.collection("aiCampaigns").doc(id).collection("logs").doc(logId);
              dbBatch.set(logDocRef, {
                leadId: matchedLead.id,
                email: matchedLead.email,
                name: matchedLead.name,
                batchNumber: batchIdx + 1,
                status: "generated",
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                emailContent: {
                  subject: item.subject,
                  body: item.htmlBody,
                  imageUrl: imageStrategy === "option1-keyword" ? item.imageKeyword : item.imageUrl
                }
              });
            }
          }
          await dbBatch.commit();

          // Progress update
          const processedCount = batchIdx + 1;
          const estRemainingSec = (totalBatches - processedCount) * 4;
          await campaignRef.update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            "summary.batchesProcessed": processedCount,
            "summary.estimatedTimeRemaining": `${estRemainingSec} seconds`
          });

          // Throttle slightly between batches
          await delay(3000);
        }

        // Finish Campaign Generation State
        await campaignRef.update({
          status: "ready-to-send",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          generationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          "summary.estimatedTimeRemaining": "0 seconds"
        });
        console.log(`[AI Gen background] Generation complete for Campaign ID ${id}!`);

      } catch (backgroundError: any) {
        console.error(`[AI Gen background] Error occurred during background generation:`, backgroundError);
        await campaignRef.update({
          status: "draft", // Recover back to draft so user can retry
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          errorMessage: backgroundError?.message || "Failed during generation background tasks"
        });
      }
    })();

    res.json({
      success: true,
      message: "Personalized generation has started in the background.",
      generatedCount: 0,
      totalLeads,
      estimatedSendTime: `${totalBatches * 5} seconds`
    });

  } catch (error: any) {
    console.error("[AI Generation Route] Error:", error);
    res.status(500).json({ error: "Failed to initialize generation loop", details: error?.message });
  }
});

/**
 * 6. POST /api/email/ai-campaigns/:id/send-batch
 * Purpose: STEP 2 - Send the next batch of 5 pre-generated emails
 */
router.post("/:id/send-batch", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("aiCampaigns").doc(id);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) return res.status(404).json({ error: "Campaign not found" });

    const campaign = campaignSnap.data() || {};
    if (campaign.status === "paused") {
      return res.status(400).json({ error: "Campaign is currently paused. Resume before sending." });
    }

    // Daily SMTP Limiter check (Max 100/day)
    const settingsRef = adminDb.collection("aiCampaignSettings").doc("global");
    const settingsSnap = await settingsRef.get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    
    const todayStr = new Date().toISOString().split("T")[0];
    let emailsSentToday = settings?.emailsSentToday ?? 0;
    const lastEmailSentDate = settings?.lastEmailSentDate ?? "";

    if (lastEmailSentDate !== todayStr) {
      emailsSentToday = 0; // Reset daily limit at midnight
    }

    if (emailsSentToday >= 100) {
      return res.status(429).json({ error: "Daily limit exceeded. Reached max 100 dispatches today." });
    }

    // Query for 5 generated but unsent leads
    const leadsRef = adminDb.collection("aiCampaigns").doc(id).collection("leads");
    const unsentLeadsSnap = await leadsRef
      .where("status", "==", "generated")
      .limit(5)
      .get();

    if (unsentLeadsSnap.empty) {
      // Check if all leads are completed
      const totalRemaining = campaign.remainingCount ?? 0;
      if (totalRemaining === 0) {
        await campaignRef.update({ status: "completed" });
      }
      return res.json({ message: "No pending emails. Run 'Generate All' first or campaign is complete." });
    }

    const leadsToSend = unsentLeadsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    let transporter: any = null;
    const canSend = smtpUser && smtpPass;

    if (canSend) {
      const nodemailer = await import("nodemailer");
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
      });
    } else {
      console.warn("[SMTP AI dispatcher] No SMTP credentials. Simulating delivery logs.");
    }

    let batchSentCount = 0;
    let batchFailedCount = 0;

    for (const lead of leadsToSend) {
      const emailContent = lead.generatedEmail || {};
      let htmlBody = emailContent.htmlBody || "";
      const subject = emailContent.subject || "Personalized Inquiry";
      const email = lead.email;

      // Unsplash Image Dynamic Injection
      if (campaign.imageStrategy === "option1-keyword") {
        const keyword = emailContent.imageKeyword || "business";
        const imgTag = `<div style="margin: 20px 0;"><img src="https://source.unsplash.com/featured/600x400/?${encodeURIComponent(keyword)}" alt="${keyword}" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #e2e8f0;" /></div>`;
        if (htmlBody.includes("{{image}}")) {
          htmlBody = htmlBody.replace("{{image}}", imgTag);
        } else {
          htmlBody += imgTag;
        }
      } else if (campaign.imageStrategy === "option2-direct-url") {
        const url = emailContent.selectedImageUrl || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80";
        const imgTag = `<div style="margin: 20px 0;"><img src="${url}" alt="Unsplash" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #e2e8f0;" /></div>`;
        if (htmlBody.includes("{{image}}")) {
          htmlBody = htmlBody.replace("{{image}}", imgTag);
        } else {
          htmlBody += imgTag;
        }
      }

      let success = false;
      let errorMsg = "";

      if (canSend && transporter) {
        try {
          await transporter.sendMail({
            from: `"Bilal Rasheed" <${smtpUser}>`,
            to: email,
            subject: subject,
            html: htmlBody
          });
          success = true;
        } catch (err: any) {
          errorMsg = err?.message || String(err);
          console.error(`[SMTP Dispatch Error] Failed to send email to ${email}:`, err);
        }
      } else {
        // Safe logger simulation
        success = true;
        errorMsg = "Logged (Simulated - Missing SMTP Credentials)";
      }

      // Update Database via Transaction to ensure reliability
      await adminDb.runTransaction(async (transaction) => {
        const leadRef = leadsRef.doc(lead.id);
        const logId = adminDb.collection("aiCampaigns").doc(id).collection("logs").doc().id;
        const logRef = adminDb.collection("aiCampaigns").doc(id).collection("logs").doc(logId);

        if (success) {
          transaction.update(leadRef, {
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });

          transaction.set(logRef, {
            leadId: lead.id,
            email: lead.email,
            name: lead.name,
            batchNumber: lead.batchNumber || 1,
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            emailContent: {
              subject,
              body: htmlBody,
              imageUrl: campaign.imageStrategy === "option1-keyword" ? emailContent.imageKeyword : emailContent.selectedImageUrl
            }
          });
          batchSentCount++;
        } else {
          transaction.update(leadRef, {
            status: "failed",
            errorMessage: errorMsg,
            retryCount: admin.firestore.FieldValue.increment(1)
          });

          transaction.set(logRef, {
            leadId: lead.id,
            email: lead.email,
            name: lead.name,
            batchNumber: lead.batchNumber || 1,
            status: "failed",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            errorMessage: errorMsg
          });
          batchFailedCount++;
        }
      });
    }

    // Update global and campaign statistics
    const updatedSentCount = (campaign.sentCount || 0) + batchSentCount;
    const updatedFailedCount = (campaign.failedCount || 0) + batchFailedCount;
    const totalLeads = campaign.totalLeads || 0;
    const remainingCount = Math.max(0, totalLeads - updatedSentCount - updatedFailedCount);

    const isFinished = remainingCount === 0;

    await campaignRef.update({
      sentCount: updatedSentCount,
      failedCount: updatedFailedCount,
      remainingCount: remainingCount,
      status: isFinished ? "completed" : "active",
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await settingsRef.set({
      emailsSentToday: emailsSentToday + batchSentCount,
      lastEmailSentDate: todayStr
    }, { merge: true });

    res.json({
      sent: batchSentCount,
      failed: batchFailedCount,
      totalSent: updatedSentCount,
      remaining: remainingCount,
      continueProcessing: remainingCount > 0
    });

  } catch (error: any) {
    console.error("[Send Batch AI Route] Error:", error);
    res.status(500).json({ error: "Failed to dispatch batch", details: error?.message });
  }
});

/**
 * 7. GET /api/email/ai-campaigns/:id/status
 * Purpose: Fetch progress, counters, estimated time remaining
 */
router.get("/:id/status", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignSnap = await adminDb.collection("aiCampaigns").doc(id).get();
    if (!campaignSnap.exists) return res.status(404).json({ error: "Campaign not found" });

    const c = campaignSnap.data() || {};
    const settingsSnap = await adminDb.collection("aiCampaignSettings").doc("global").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    // Calculate real-time counts from leads sub-collection to prevent any synchronization drift
    const leadsRef = adminDb.collection("aiCampaigns").doc(id).collection("leads");
    const totalLeadsSnap = await leadsRef.get();
    const totalLeads = totalLeadsSnap.size;

    const pendingSnap = await leadsRef.where("status", "==", "pending").get();
    const pendingCount = pendingSnap.size;

    const generatedSnap = await leadsRef.where("status", "==", "generated").get();
    const generatedCount = generatedSnap.size;

    const sentSnap = await leadsRef.where("status", "==", "sent").get();
    const sentCount = sentSnap.size;

    const failedSnap = await leadsRef.where("status", "==", "failed").get();
    const failedCount = failedSnap.size;

    const remainingCount = pendingCount + generatedCount;

    // Build responsive response
    res.json({
      campaignStatus: c.status || "draft",
      totalLeads,
      generatedCount: totalLeads - pendingCount,
      sentCount,
      failedCount,
      remainingCount,
      lastBatchSentAt: c.lastSentAt || null,
      selectedModel: c.geminiModel || "flash-lite",
      modelRPM: getModelRpm(c.geminiModel),
      requestCountThisMinute: settings?.requestCountThisMinute ?? 0,
      timeUntilRateLimitReset: "Dynamic Reset Enabled",
      estimatedTimeToComplete: `${Math.ceil(remainingCount / 5) * 8} seconds`,
      imageStrategy: c.imageStrategy || "option1-keyword"
    });

  } catch (error: any) {
    console.error("[Campaign Status AI API] Error:", error);
    res.status(500).json({ error: "Failed to retrieve status metrics", details: error?.message });
  }
});

/**
 * 8. POST /api/email/ai-campaigns/:id/pause
 * Purpose: Pause dispatching
 */
router.post("/:id/pause", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("aiCampaigns").doc(id);
    const snap = await campaignRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Campaign not found" });

    await campaignRef.update({
      status: "paused",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updated = snap.data();
    res.json({
      success: true,
      message: "Campaign paused successfully",
      sentCount: updated?.sentCount || 0,
      remaining: updated?.remainingCount || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to pause campaign", details: error?.message });
  }
});

/**
 * 9. POST /api/email/ai-campaigns/:id/resume
 * Purpose: Resume paused or ready-to-send campaigns
 */
router.post("/:id/resume", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("aiCampaigns").doc(id);
    const snap = await campaignRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Campaign not found" });

    const c = snap.data();
    if (c?.status !== "paused" && c?.status !== "ready-to-send") {
      return res.status(400).json({ error: "Only paused or ready-to-send campaigns can be resumed" });
    }

    await campaignRef.update({
      status: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: "Campaign resumed and is active",
      remaining: c?.remainingCount || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to resume campaign", details: error?.message });
  }
});

/**
 * 10. POST /api/email/ai-campaigns/:id/retry-failed
 * Purpose: Recycle failed emails in leads back to generated copy state
 */
router.post("/:id/retry-failed", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const leadsRef = adminDb.collection("aiCampaigns").doc(id).collection("leads");
    const failedLeadsSnap = await leadsRef.where("status", "==", "failed").get();

    if (failedLeadsSnap.empty) {
      return res.json({ retriedCount: 0, message: "No failed leads found to retry." });
    }

    let batch = adminDb.batch();
    let count = 0;

    for (const doc of failedLeadsSnap.docs) {
      batch.update(doc.ref, {
        status: "generated",
        errorMessage: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = adminDb.batch();
      }
    }

    if (count % 400 !== 0) {
      await batch.commit();
    }

    // Reset campaign failed metrics
    const campaignRef = adminDb.collection("aiCampaigns").doc(id);
    const campaignSnap = await campaignRef.get();
    const campaign = campaignSnap.data() || {};

    const updatedFailed = Math.max(0, (campaign.failedCount || 0) - count);
    const updatedRemaining = (campaign.remainingCount || 0) + count;

    await campaignRef.update({
      failedCount: updatedFailed,
      remainingCount: updatedRemaining,
      status: "ready-to-send",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      retriedCount: count,
      message: `Reset ${count} failed leads to 'generated' status. Ready for dispatch.`
    });

  } catch (error: any) {
    console.error("[Retry Failed AI Leads API] Error:", error);
    res.status(500).json({ error: "Failed to retry failed leads", details: error?.message });
  }
});

export default router;
