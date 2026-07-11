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
    
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    res.json({ id: docSnap.id, ...docSnap.data() });
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

export default router;
