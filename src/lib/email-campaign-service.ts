import admin, { adminDb } from "./firebase-admin.js";
import nodemailer from "nodemailer";

export interface EmailSettings {
  dailyLimit: number;
  emailsSentToday: number;
  lastSentDate: string;
  batchSize: number;
  autoPause: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  subject: string;
  content: string;
  templateId?: string;
  status: "active" | "draft" | "completed" | "paused" | "failed";
  sentCount: number;
  totalRecipients: number;
  scheduledAt?: string;
  createdBy?: string;
  errorMessage?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  email: string;
  name?: string;
  status: "pending" | "sent" | "failed";
  sentAt?: admin.firestore.Timestamp;
  errorMessage?: string;
}

/**
 * Normalizes Date to YYYY-MM-DD string in UTC/GMT
 */
function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Gets or initializes the global email settings in Firestore.
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  if (!adminDb) throw new Error("adminDb is not initialized");

  const settingsRef = adminDb.collection("emailSettings").doc("global");
  const docSnap = await settingsRef.get();

  if (!docSnap.exists) {
    const defaultSettings: EmailSettings = {
      dailyLimit: 100,
      emailsSentToday: 0,
      lastSentDate: getTodayDateString(),
      batchSize: 5,
      autoPause: true
    };
    await settingsRef.set(defaultSettings);
    return defaultSettings;
  }

  return docSnap.data() as EmailSettings;
}

/**
 * Core function to send an individual email using Nodemailer SMTP.
 */
async function sendMailViaSMTP(to: string, subject: string, html: string, text?: string): Promise<{ success: boolean; error?: string; mode: string }> {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
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
        from: `"Portfolio Notification" <${smtpUser}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ""),
        html: html,
      });

      return { success: true, mode: "SMTP" };
    } catch (err: any) {
      console.error("[EmailCampaignService] SMTP transmission failed:", err);
      return { success: false, error: err?.message || String(err), mode: "SMTP" };
    }
  }

  // Fallback / Sandbox Mode if credentials aren't set
  console.log(`[EmailCampaignService] SMTP config missing. Simulating sending email to: ${to}`);
  return { success: true, mode: "SIMULATION" };
}

/**
 * Runs validation checks on campaigns before execution.
 * Checks for recipient count limits and active campaign limits.
 */
export async function validateAndNormalizeCampaign(campaignId: string): Promise<{ valid: boolean; error?: string }> {
  if (!adminDb) return { valid: false, error: "Database not available" };

  const campaignRef = adminDb.collection("campaigns").doc(campaignId);
  const campaignDoc = await campaignRef.get();

  if (!campaignDoc.exists) {
    return { valid: false, error: "Campaign not found" };
  }

  const campaign = campaignDoc.data() as Campaign;

  // 1. Check active campaigns limit (max 3)
  if (campaign.status === "active") {
    const activeCampaignsQuery = await adminDb.collection("campaigns")
      .where("status", "==", "active")
      .get();
    
    // Filter out our own campaign from active check
    const activeCount = activeCampaignsQuery.docs.filter(d => d.id !== campaignId).length;
    if (activeCount >= 3) {
      return { valid: false, error: "Limit exceeded: Max 3 active campaigns allowed simultaneously." };
    }
  }

  // 2. Limit recipients per campaign to 500
  const recipientsQuery = await adminDb.collection("campaignRecipients")
    .where("campaignId", "==", campaignId)
    .get();

  const recipientCount = recipientsQuery.size;
  if (recipientCount > 500) {
    return { valid: false, error: `Recipient limit exceeded: Campaign has ${recipientCount} recipients. Max allowed is 500.` };
  }

  // Update totalRecipients inside campaign document to keep in sync
  await campaignRef.update({ totalRecipients: recipientCount });

  return { valid: true };
}

/**
 * Processes the email queue.
 * - Checks daily quotas and resets daily count if day changed.
 * - Sends up to 5 emails (batchSize) across active campaigns.
 * - Handles auto-pausing when daily limit is reached.
 * - Log successes and errors to emailLogs collection.
 */
export async function processEmailQueue(): Promise<{
  processed: number;
  successes: number;
  failures: number;
  limitReached: boolean;
  notes: string;
}> {
  if (!adminDb) {
    return { processed: 0, successes: 0, failures: 0, limitReached: false, notes: "No database connection" };
  }

  console.log("[EmailCampaignService] Starting cron run to process pending emails...");

  // 1. Fetch current settings & check limits
  let settings = await getEmailSettings();
  const todayStr = getTodayDateString();

  if (settings.lastSentDate !== todayStr) {
    console.log(`[EmailCampaignService] Day changed. Resetting emailsSentToday count. Previous Date: ${settings.lastSentDate}, New Date: ${todayStr}`);
    settings.emailsSentToday = 0;
    settings.lastSentDate = todayStr;
    await adminDb.collection("emailSettings").doc("global").set(settings);
  }

  if (settings.emailsSentToday >= settings.dailyLimit) {
    console.warn(`[EmailCampaignService] Daily send limit (${settings.dailyLimit}) reached. Skipping queue processing today.`);
    return { processed: 0, successes: 0, failures: 0, limitReached: true, notes: "Daily limit reached" };
  }

  // 2. Query active campaigns (Limit to 3 active campaigns as requested)
  const activeCampaignsSnap = await adminDb.collection("campaigns")
    .where("status", "==", "active")
    .limit(3)
    .get();

  if (activeCampaignsSnap.empty) {
    console.log("[EmailCampaignService] No active email campaigns to process.");
    return { processed: 0, successes: 0, failures: 0, limitReached: false, notes: "No active campaigns" };
  }

  const batchSize = Math.min(settings.batchSize, 5); // Hard cap of 5 emails per cron execution
  let emailsSentThisRun = 0;
  let successesThisRun = 0;
  let failuresThisRun = 0;
  let limitHitDuringRun = false;

  const campaignDocs = activeCampaignsSnap.docs;

  // Process across active campaigns
  for (const campaignDoc of campaignDocs) {
    if (emailsSentThisRun >= batchSize) break;
    if (settings.emailsSentToday >= settings.dailyLimit) {
      limitHitDuringRun = true;
      break;
    }

    const campaignId = campaignDoc.id;
    const campaign = campaignDoc.data() as Campaign;

    // Run double check validations
    const validation = await validateAndNormalizeCampaign(campaignId);
    if (!validation.valid) {
      console.warn(`[EmailCampaignService] Campaign ${campaignId} failed validation: ${validation.error}. Pausing campaign.`);
      await adminDb.collection("campaigns").doc(campaignId).update({
        status: "failed",
        errorMessage: validation.error,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      continue;
    }

    // Fetch template details if templateId exists
    let template: EmailTemplate | null = null;
    if (campaign.templateId) {
      const templateDoc = await adminDb.collection("emailTemplates").doc(campaign.templateId).get();
      if (templateDoc.exists) {
        template = templateDoc.data() as EmailTemplate;
      }
    }

    // Fetch pending recipients for this campaign
    const remainingToProcess = batchSize - emailsSentThisRun;
    const pendingRecipientsSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("status", "==", "pending")
      .limit(remainingToProcess)
      .get();

    if (pendingRecipientsSnap.empty) {
      // If there are no more pending recipients, mark campaign completed
      console.log(`[EmailCampaignService] Campaign ${campaignId} ("${campaign.title}") has no more pending recipients. Completing campaign.`);
      await adminDb.collection("campaigns").doc(campaignId).update({
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      continue;
    }

    // Process recipients
    for (const recDoc of pendingRecipientsSnap.docs) {
      if (emailsSentThisRun >= batchSize) break;
      
      // Quota check before each individual message dispatch
      if (settings.emailsSentToday >= settings.dailyLimit) {
        limitHitDuringRun = true;
        break;
      }

      const recId = recDoc.id;
      const recipient = recDoc.data() as CampaignRecipient;

      // Render the final content
      let finalHtml = campaign.content;
      let finalSubject = campaign.subject;

      if (template) {
        // Wrap campaign content inside the template
        finalHtml = template.bodyHtml.replace("{{content}}", campaign.content);
        if (!campaign.subject) {
          finalSubject = template.subject;
        }
      }

      // Replace common recipient placeholders
      const recName = recipient.name || "Subscriber";
      finalHtml = finalHtml.replace(/\{\{name\}\}/gi, recName).replace(/\{\{email\}\}/gi, recipient.email);
      finalSubject = finalSubject.replace(/\{\{name\}\}/gi, recName).replace(/\{\{email\}\}/gi, recipient.email);

      // Perform mail send
      console.log(`[EmailCampaignService] Dispatching campaign email to ${recipient.email}...`);
      const sendResult = await sendMailViaSMTP(recipient.email, finalSubject, finalHtml);

      const logId = adminDb.collection("emailLogs").doc().id;

      if (sendResult.success) {
        // Success: update counters, set recipient status
        successesThisRun++;
        emailsSentThisRun++;
        settings.emailsSentToday++;

        // Update recipient
        await adminDb.collection("campaignRecipients").doc(recId).update({
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add email send log
        await adminDb.collection("emailLogs").doc(logId).set({
          id: logId,
          campaignId,
          recipientEmail: recipient.email,
          status: "sent",
          smtpUsed: sendResult.mode,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Increment campaign sent count
        await adminDb.collection("campaigns").doc(campaignId).update({
          sentCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Fail: mark failed, write error log
        failuresThisRun++;
        emailsSentThisRun++;

        // Update recipient
        await adminDb.collection("campaignRecipients").doc(recId).update({
          status: "failed",
          errorMessage: sendResult.error || "Failed sending SMTP packet",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add email fail log
        await adminDb.collection("emailLogs").doc(logId).set({
          id: logId,
          campaignId,
          recipientEmail: recipient.email,
          status: "failed",
          errorMessage: sendResult.error || "SMTP error",
          smtpUsed: sendResult.mode,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Check if campaign is now completed
    const pendingCheck = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (pendingCheck.empty) {
      console.log(`[EmailCampaignService] Campaign ${campaignId} completed! All recipients processed.`);
      await adminDb.collection("campaigns").doc(campaignId).update({
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  // 3. Save finalized throttling stats
  await adminDb.collection("emailSettings").doc("global").set(settings);

  // If daily quota was hit during the queue loop, pause all remaining active campaigns to preserve integrity
  if (limitHitDuringRun) {
    console.warn("[EmailCampaignService] Daily quota limit reached during processing! Pausing active campaigns to prevent further queue builds.");
    
    // Auto-pause all active campaigns
    const activeSnaps = await adminDb.collection("campaigns")
      .where("status", "==", "active")
      .get();

    for (const actDoc of activeSnaps.docs) {
      await adminDb.collection("campaigns").doc(actDoc.id).update({
        status: "paused",
        errorMessage: "Auto-paused: Daily sending quota reached.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  const resultNotes = `Completed run: ${emailsSentThisRun} emails processed. (${successesThisRun} Succeeded, ${failuresThisRun} Failed). Daily limit remaining: ${settings.dailyLimit - settings.emailsSentToday}`;
  console.log(`[EmailCampaignService] ${resultNotes}`);

  return {
    processed: emailsSentThisRun,
    successes: successesThisRun,
    failures: failuresThisRun,
    limitReached: limitHitDuringRun || (settings.emailsSentToday >= settings.dailyLimit),
    notes: resultNotes
  };
}

/**
 * Processes up to 50 pending emails manually.
 * This is designed for manual queue triggers from the Admin Panel.
 * Runs concurrent dispatches so it completes in under 10 seconds.
 */
export async function processManualEmailQueue(maxEmails: number = 50, campaignIdFilter?: string): Promise<{
  processed: number;
  successes: number;
  failures: number;
  limitReached: boolean;
  notes: string;
}> {
  if (!adminDb) {
    return { processed: 0, successes: 0, failures: 0, limitReached: false, notes: "No database connection" };
  }

  console.log(`[EmailCampaignService] Starting manual queue processing (max: ${maxEmails}, campaign filter: ${campaignIdFilter || "none"})...`);

  // 1. Fetch current settings & check limits
  let settings = await getEmailSettings();
  const todayStr = getTodayDateString();

  if (settings.lastSentDate !== todayStr) {
    console.log(`[EmailCampaignService] Day changed. Resetting emailsSentToday count.`);
    settings.emailsSentToday = 0;
    settings.lastSentDate = todayStr;
    await adminDb.collection("emailSettings").doc("global").set(settings);
  }

  const remainingQuota = Math.max(0, settings.dailyLimit - settings.emailsSentToday);
  if (remainingQuota <= 0) {
    return { processed: 0, successes: 0, failures: 0, limitReached: true, notes: "Daily limit reached" };
  }

  const toSendCount = Math.min(maxEmails, remainingQuota);
  if (toSendCount <= 0) {
    return { processed: 0, successes: 0, failures: 0, limitReached: true, notes: "Daily limit reached" };
  }

  // 2. Query campaigns
  let campaignDocs: any[] = [];
  if (campaignIdFilter) {
    const campaignDoc = await adminDb.collection("campaigns").doc(campaignIdFilter).get();
    if (campaignDoc.exists) {
      campaignDocs = [campaignDoc];
    }
  } else {
    const activeCampaignsSnap = await adminDb.collection("campaigns")
      .where("status", "==", "active")
      .limit(3)
      .get();
    campaignDocs = activeCampaignsSnap.docs;
  }

  if (campaignDocs.length === 0) {
    return { processed: 0, successes: 0, failures: 0, limitReached: false, notes: "No campaigns to process" };
  }

  // 3. Collect jobs up to toSendCount
  const pendingJobs: {
    recipientId: string;
    recipient: CampaignRecipient;
    campaign: Campaign;
    campaignId: string;
    template: EmailTemplate | null;
  }[] = [];

  for (const campaignDoc of campaignDocs) {
    if (pendingJobs.length >= toSendCount) break;

    const campaignId = campaignDoc.id;
    const campaign = campaignDoc.data() as Campaign;

    // Validate campaign (only validate if campaign is active and we are NOT targeting a specific campaign)
    if (!campaignIdFilter && campaign.status === "active") {
      const validation = await validateAndNormalizeCampaign(campaignId);
      if (!validation.valid) {
        console.warn(`[EmailCampaignService] Campaign ${campaignId} failed validation. Pausing campaign.`);
        await adminDb.collection("campaigns").doc(campaignId).update({
          status: "failed",
          errorMessage: validation.error,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        continue;
      }
    }

    // Fetch template details if templateId exists
    let template: EmailTemplate | null = null;
    if (campaign.templateId) {
      const templateDoc = await adminDb.collection("emailTemplates").doc(campaign.templateId).get();
      if (templateDoc.exists) {
        template = templateDoc.data() as EmailTemplate;
      }
    }

    const limitForThisCampaign = toSendCount - pendingJobs.length;
    const pendingRecipientsSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("status", "==", "pending")
      .limit(limitForThisCampaign)
      .get();

    for (const recDoc of pendingRecipientsSnap.docs) {
      pendingJobs.push({
        recipientId: recDoc.id,
        recipient: recDoc.data() as CampaignRecipient,
        campaign,
        campaignId,
        template
      });
    }
  }

  if (pendingJobs.length === 0) {
    return { processed: 0, successes: 0, failures: 0, limitReached: false, notes: "No pending emails found to process." };
  }

  let successes = 0;
  let failures = 0;

  // 4. Process all jobs concurrently to ensure we finish in under 10 seconds
  const jobPromises = pendingJobs.map(async (job) => {
    const { recipientId, recipient, campaign, campaignId, template } = job;

    // Render final content
    let finalHtml = campaign.content;
    let finalSubject = campaign.subject;

    if (template) {
      finalHtml = template.bodyHtml.replace("{{content}}", campaign.content);
      if (!campaign.subject) {
        finalSubject = template.subject;
      }
    }

    // Replace placeholders
    const recName = recipient.name || "Subscriber";
    finalHtml = finalHtml.replace(/\{\{name\}\}/gi, recName).replace(/\{\{email\}\}/gi, recipient.email);
    finalSubject = finalSubject.replace(/\{\{name\}\}/gi, recName).replace(/\{\{email\}\}/gi, recipient.email);

    // Perform mail send
    const sendResult = await sendMailViaSMTP(recipient.email, finalSubject, finalHtml);
    const logId = adminDb.collection("emailLogs").doc().id;

    if (sendResult.success) {
      successes++;
      // Update recipient
      await adminDb.collection("campaignRecipients").doc(recipientId).update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add email send log
      await adminDb.collection("emailLogs").doc(logId).set({
        id: logId,
        campaignId,
        recipientEmail: recipient.email,
        status: "sent",
        smtpUsed: sendResult.mode,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Increment campaign sent count
      await adminDb.collection("campaigns").doc(campaignId).update({
        sentCount: admin.firestore.FieldValue.increment(1),
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      failures++;
      // Update recipient
      await adminDb.collection("campaignRecipients").doc(recipientId).update({
        status: "failed",
        errorMessage: sendResult.error || "Failed sending SMTP packet",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add email fail log
      await adminDb.collection("emailLogs").doc(logId).set({
        id: logId,
        campaignId,
        recipientEmail: recipient.email,
        status: "failed",
        errorMessage: sendResult.error || "SMTP error",
        smtpUsed: sendResult.mode,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });

  await Promise.all(jobPromises);

  // 5. Update global sending stats
  settings.emailsSentToday += successes;
  await adminDb.collection("emailSettings").doc("global").set(settings);

  // 6. Check campaign completion for each campaign processed
  const campaignIdsToCheck = Array.from(new Set(pendingJobs.map(j => j.campaignId)));
  for (const cid of campaignIdsToCheck) {
    const pendingCheck = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", cid)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (pendingCheck.empty) {
      console.log(`[EmailCampaignService] Campaign ${cid} completed! All recipients processed.`);
      await adminDb.collection("campaigns").doc(cid).update({
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  // 7. Auto-pause if daily limit was hit
  const limitReached = settings.emailsSentToday >= settings.dailyLimit;
  if (limitReached) {
    console.warn("[EmailCampaignService] Daily quota reached manually. Pausing remaining active campaigns.");
    const activeSnaps = await adminDb.collection("campaigns")
      .where("status", "==", "active")
      .get();

    for (const actDoc of activeSnaps.docs) {
      await adminDb.collection("campaigns").doc(actDoc.id).update({
        status: "paused",
        errorMessage: "Auto-paused: Daily sending quota reached.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  const resultNotes = `Manual run: Sent ${successes} successfully, ${failures} failed. Remaining today: ${settings.dailyLimit - settings.emailsSentToday}`;
  console.log(`[EmailCampaignService] ${resultNotes}`);

  return {
    processed: pendingJobs.length,
    successes,
    failures,
    limitReached,
    notes: resultNotes
  };
}
