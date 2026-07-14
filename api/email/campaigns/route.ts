import express from "express";
import { adminDb } from "../../../src/lib/firebase-admin.js";
import admin from "../../../src/lib/firebase-admin.js";
import { requireAdminAuth } from "../../../src/lib/email-auth.js";
import { validateAndNormalizeCampaign } from "../../../src/lib/email-campaign-service.js";

const router = express.Router();

// Apply superadmin auth middleware to all campaign routes
router.use(requireAdminAuth as express.RequestHandler);

/**
 * GET /api/email/campaigns
 * Fetch all campaigns
 */
router.get("/", async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const snapshot = await adminDb.collection("campaigns")
      .orderBy("createdAt", "desc")
      .get();
    
    const campaigns = await Promise.all(snapshot.docs.map(async doc => {
      const campaignId = doc.id;
      const data = doc.data() || {};
      
      const pendingSnap = await adminDb.collection("campaignRecipients")
        .where("campaignId", "==", campaignId)
        .where("status", "==", "pending")
        .get();

      const failedSnap = await adminDb.collection("campaignRecipients")
        .where("campaignId", "==", campaignId)
        .where("status", "==", "failed")
        .get();

      const sentSnap = await adminDb.collection("campaignRecipients")
        .where("campaignId", "==", campaignId)
        .where("status", "==", "sent")
        .get();
        
      return {
        id: campaignId,
        ...data,
        pendingCount: pendingSnap.size,
        failedCount: failedSnap.size,
        sentCount: sentSnap.size
      };
    }));
    res.json(campaigns);
  } catch (error: any) {
    console.error("[Campaigns API] Error fetching campaigns:", error);
    res.status(500).json({ error: "Failed to fetch campaigns", details: error?.message });
  }
});

/**
 * GET /api/email/campaigns/:id
 * Fetch single campaign details
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const docSnap = await adminDb.collection("campaigns").doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const campaignId = docSnap.id;
    const data = docSnap.data() || {};

    const pendingSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("status", "==", "pending")
      .get();

    const failedSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("status", "==", "failed")
      .get();

    const sentSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("status", "==", "sent")
      .get();

    res.json({
      id: campaignId,
      ...data,
      pendingCount: pendingSnap.size,
      failedCount: failedSnap.size,
      sentCount: sentSnap.size
    });
  } catch (error: any) {
    console.error("[Campaigns API] Error fetching campaign details:", error);
    res.status(500).json({ error: "Failed to fetch campaign details", details: error?.message });
  }
});

/**
 * POST /api/email/campaigns
 * Create a new campaign
 */
router.post("/", async (req, res) => {
  const { title, subject, content, templateId } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: "Campaign title is required" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignId = adminDb.collection("campaigns").doc().id;
    const payload = {
      id: campaignId,
      title,
      subject: subject || "",
      content: content || "",
      templateId: templateId || null,
      status: "draft",
      sentCount: 0,
      totalRecipients: 0,
      createdBy: (req as any).adminEmail || "muhammadbilalrasheed78@gmail.com",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await adminDb.collection("campaigns").doc(campaignId).set(payload);
    res.status(211).json({ success: true, campaign: payload });
  } catch (error: any) {
    console.error("[Campaigns API] Error creating campaign:", error);
    res.status(500).json({ error: "Failed to create campaign", details: error?.message });
  }
});

/**
 * PUT /api/email/campaigns/:id
 * Update campaign details (Only allowed for 'draft' or 'paused' campaigns)
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, subject, content, templateId } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Campaign title is required" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(id);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignSnap.data();
    if (campaign?.status !== "draft" && campaign?.status !== "paused") {
      return res.status(400).json({ error: "Only draft or paused campaigns can be modified." });
    }

    const payload = {
      title,
      subject: subject || "",
      content: content || "",
      templateId: templateId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await campaignRef.update(payload);
    res.json({ success: true, campaign: { ...campaign, ...payload } });
  } catch (error: any) {
    console.error("[Campaigns API] Error updating campaign:", error);
    res.status(500).json({ error: "Failed to update campaign", details: error?.message });
  }
});

/**
 * DELETE /api/email/campaigns/:id
 * Delete a campaign (Only allowed for 'draft' campaigns)
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(id);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignSnap.data();
    if (campaign?.status !== "draft") {
      return res.status(400).json({ error: "Only draft campaigns can be deleted." });
    }

    // Use a Firestore Batch to delete campaign and all its recipients
    const batch = adminDb.batch();
    batch.delete(campaignRef);

    // Get all associated recipients
    const recipientsSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", id)
      .get();
    
    recipientsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ success: true, message: "Campaign and associated recipients deleted successfully." });
  } catch (error: any) {
    console.error("[Campaigns API] Error deleting campaign:", error);
    res.status(500).json({ error: "Failed to delete campaign", details: error?.message });
  }
});

/**
 * POST /api/email/campaigns/:id/toggle
 * Toggle campaign status between paused/draft and active.
 */
router.post("/:id/toggle", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(id);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignSnap.data();
    let newStatus = "";

    if (campaign?.status === "active") {
      newStatus = "paused";
    } else if (campaign?.status === "paused" || campaign?.status === "draft" || campaign?.status === "failed") {
      newStatus = "active";
    } else {
      return res.status(400).json({ error: `Cannot toggle campaign in state: ${campaign?.status}` });
    }

    // If activating, run the double check validation layer
    if (newStatus === "active") {
      // Ensure campaign has recipients first
      const recipientsSnap = await adminDb.collection("campaignRecipients")
        .where("campaignId", "==", id)
        .limit(1)
        .get();

      if (recipientsSnap.empty) {
        return res.status(400).json({ error: "Cannot activate a campaign with 0 recipients. Please upload a recipient list first." });
      }

      const validation = await validateAndNormalizeCampaign(id);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    await campaignRef.update({
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("[Campaigns API] Error toggling campaign:", error);
    res.status(500).json({ error: "Failed to toggle campaign status", details: error?.message });
  }
});

/**
 * GET /api/email/campaigns/:id/failed-recipients
 * Purpose: Fetch all recipients in 'failed' status for a specific campaign
 */
router.get("/:id/failed-recipients", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const recSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", id)
      .where("status", "==", "failed")
      .get();
    const failedRecipients = recSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, failedRecipients });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch failed recipients", details: error?.message });
  }
});

/**
 * POST /api/email/campaigns/:id/retry-recipient/:recId
 * Purpose: Reset a single failed recipient to 'pending' status
 */
router.post("/:id/retry-recipient/:recId", async (req, res) => {
  const { id, recId } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(id);
    const recRef = adminDb.collection("campaignRecipients").doc(recId);
    const recSnap = await recRef.get();
    if (!recSnap.exists) return res.status(404).json({ error: "Recipient not found" });

    const recipient = recSnap.data();
    if (recipient?.status !== "failed") {
      return res.status(400).json({ error: "Only failed recipients can be retried." });
    }

    await recRef.update({
      status: "pending",
      errorMessage: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const campaignSnap = await campaignRef.get();
    const campaign = campaignSnap.data() || {};
    const updatedStatus = campaign.status === "completed" ? "active" : campaign.status;

    await campaignRef.update({
      status: updatedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: "Recipient reset to 'pending' state. Ready for sending." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retry recipient", details: error?.message });
  }
});

/**
 * POST /api/email/campaigns/:id/retry-failed
 * Purpose: Reset ALL failed recipients back to 'pending' status
 */
router.post("/:id/retry-failed", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(id);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) return res.status(404).json({ error: "Campaign not found" });

    const failedSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", id)
      .where("status", "==", "failed")
      .get();

    if (failedSnap.empty) {
      return res.status(400).json({ error: "No failed recipients found to retry." });
    }

    let batch = adminDb.batch();
    let count = 0;
    for (const doc of failedSnap.docs) {
      batch.update(doc.ref, {
        status: "pending",
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

    const campaign = campaignSnap.data() || {};
    const updatedStatus = campaign.status === "completed" ? "active" : campaign.status;

    await campaignRef.update({
      status: updatedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: `Successfully reset ${count} failed recipients to 'pending'.` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retry all failed recipients", details: error?.message });
  }
});

/**
 * POST /api/email/campaigns/:id/reactivate
 * Purpose: Save current completed run to history and reset campaign to allow editing and restarting a run
 */
router.post("/:id/reactivate", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(id);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) return res.status(404).json({ error: "Campaign not found" });

    const campaign = campaignSnap.data() || {};

    const recipientsSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", id)
      .get();
    const recipientsData = recipientsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const runId = adminDb.collection("campaigns").doc().id;

    // Create a history log entry
    const historyRef = campaignRef.collection("history").doc(runId);
    await historyRef.set({
      runId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      title: campaign.title || "",
      subject: campaign.subject || "",
      content: campaign.content || "",
      templateId: campaign.templateId || null,
      totalRecipients: campaign.totalRecipients || 0,
      sentCount: campaign.sentCount || 0,
      recipients: recipientsData
    });

    // Reset current active campaign
    await campaignRef.update({
      status: "draft",
      sentCount: 0,
      errorMessage: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Reset all recipients back to pending
    let batch = adminDb.batch();
    let count = 0;
    for (const doc of recipientsSnap.docs) {
      batch.update(doc.ref, {
        status: "pending",
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

    res.json({
      success: true,
      message: "Campaign reactivated successfully! Status is reset to draft. You can now edit the email message and subject."
    });

  } catch (error: any) {
    console.error("[Reactivate Campaign API] Error:", error);
    res.status(500).json({ error: "Failed to reactivate campaign", details: error?.message });
  }
});

/**
 * GET /api/email/campaigns/:id/history
 * Purpose: Fetch all archived campaign run history entries
 */
router.get("/:id/history", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const historyRef = adminDb.collection("campaigns").doc(id).collection("history");
    const historySnap = await historyRef.orderBy("timestamp", "desc").get();
    const historyRuns = historySnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, historyRuns });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch campaign history", details: error?.message });
  }
});

export default router;
