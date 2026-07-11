import express from "express";
import { adminDb } from "../../../src/lib/firebase-admin.js";
import admin from "../../../src/lib/firebase-admin.js";
import { requireAdminAuth } from "../../../src/lib/email-auth.js";
import { parseRecipientsCSV, isValidEmail } from "../../../src/lib/email-service.js";

const router = express.Router();

// Apply superadmin auth middleware to all recipient routes
router.use(requireAdminAuth as express.RequestHandler);

/**
 * GET /api/email/recipients/campaign/:campaignId
 * Fetch all recipients for a campaign
 */
router.get("/campaign/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const snapshot = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .get();
    
    const recipients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(recipients);
  } catch (error: any) {
    console.error("[Recipients API] Error fetching recipients:", error);
    res.status(500).json({ error: "Failed to fetch recipients", details: error?.message });
  }
});

/**
 * POST /api/email/recipients/upload
 * Bulk upload recipients via CSV string. Receives campaignId and csvContent.
 */
router.post("/upload", async (req, res) => {
  const { campaignId, csvContent } = req.body;

  if (!campaignId || !csvContent) {
    return res.status(400).json({ error: "campaignId and csvContent are required" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    // 1. Check if campaign exists
    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignSnap.data();
    if (campaign?.status !== "draft" && campaign?.status !== "paused") {
      return res.status(400).json({ error: "Can only add recipients to draft or paused campaigns." });
    }

    // 2. Parse CSV
    const parsed = parseRecipientsCSV(csvContent);
    if (parsed.length === 0) {
      return res.status(400).json({ error: "No valid recipients found in the uploaded CSV." });
    }

    // 3. Get existing recipients to check for duplicates
    const existingSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .get();
    
    const existingEmails = new Set(existingSnap.docs.map(doc => doc.data().email.toLowerCase()));

    // 4. Check recipient limit (Max 500)
    const currentCount = existingEmails.size;
    const incomingNewRecipients = parsed.filter(item => !existingEmails.has(item.email.toLowerCase()));
    
    if (currentCount + incomingNewRecipients.length > 500) {
      return res.status(400).json({ 
        error: `Limit exceeded: Adding these would result in ${currentCount + incomingNewRecipients.length} total recipients. Max allowed is 500.` 
      });
    }

    // 5. Bulk insert in Firestore batches (Max 500 writes per batch)
    let batch = adminDb.batch();
    let batchCount = 0;
    const addedCount = incomingNewRecipients.length;

    for (const item of incomingNewRecipients) {
      const recipientId = adminDb.collection("campaignRecipients").doc().id;
      const docRef = adminDb.collection("campaignRecipients").doc(recipientId);
      
      batch.set(docRef, {
        id: recipientId,
        campaignId,
        email: item.email,
        name: item.name || "",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Update campaign recipient counter
    const finalTotal = currentCount + addedCount;
    await campaignRef.update({
      totalRecipients: finalTotal,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ 
      success: true, 
      addedCount, 
      totalCount: finalTotal, 
      duplicatesIgnored: parsed.length - addedCount 
    });
  } catch (error: any) {
    console.error("[Recipients API] Error uploading CSV:", error);
    res.status(500).json({ error: "Failed to upload recipients", details: error?.message });
  }
});

/**
 * POST /api/email/recipients/single
 * Add a single recipient manually. Receives campaignId, email, name.
 */
router.post("/single", async (req, res) => {
  const { campaignId, email, name } = req.body;

  if (!campaignId || !email) {
    return res.status(400).json({ error: "campaignId and email are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email address format" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignSnap.data();
    if (campaign?.status !== "draft" && campaign?.status !== "paused") {
      return res.status(400).json({ error: "Can only add recipients to draft or paused campaigns." });
    }

    // Check duplicate
    const normalizedEmail = email.trim().toLowerCase();
    const existingQuery = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .where("email", "==", normalizedEmail)
      .get();
    
    if (!existingQuery.empty) {
      return res.status(400).json({ error: "This email address is already added to this campaign." });
    }

    // Check total count limit
    const totalCountQuery = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .get();
    
    if (totalCountQuery.size >= 500) {
      return res.status(400).json({ error: "Recipient limit reached: Campaign already has 500 recipients. Max allowed is 500." });
    }

    const recipientId = adminDb.collection("campaignRecipients").doc().id;
    const payload = {
      id: recipientId,
      campaignId,
      email: normalizedEmail,
      name: name?.trim() || normalizedEmail.split("@")[0],
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await adminDb.collection("campaignRecipients").doc(recipientId).set(payload);

    // Update campaign totalRecipients
    const newCount = totalCountQuery.size + 1;
    await campaignRef.update({
      totalRecipients: newCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, recipient: payload, totalCount: newCount });
  } catch (error: any) {
    console.error("[Recipients API] Error adding recipient:", error);
    res.status(500).json({ error: "Failed to add recipient", details: error?.message });
  }
});

/**
 * DELETE /api/email/recipients/:id
 * Delete an individual recipient
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const recipientRef = adminDb.collection("campaignRecipients").doc(id);
    const recipientSnap = await recipientRef.get();

    if (!recipientSnap.exists) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    const recipient = recipientSnap.data();
    const campaignId = recipient?.campaignId;

    // Check campaign status
    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (campaignSnap.exists) {
      const campaign = campaignSnap.data();
      if (campaign?.status !== "draft" && campaign?.status !== "paused") {
        return res.status(400).json({ error: "Can only modify lists of draft or paused campaigns." });
      }
    }

    await recipientRef.delete();

    // Re-calculate campaign count
    if (campaignId) {
      const remainingRecipients = await adminDb.collection("campaignRecipients")
        .where("campaignId", "==", campaignId)
        .get();
      
      await campaignRef.update({
        totalRecipients: remainingRecipients.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    res.json({ success: true, message: "Recipient deleted successfully." });
  } catch (error: any) {
    console.error("[Recipients API] Error deleting recipient:", error);
    res.status(500).json({ error: "Failed to delete recipient", details: error?.message });
  }
});

/**
 * DELETE /api/email/recipients/campaign/:campaignId
 * Clear all recipients for a campaign
 */
router.delete("/campaign/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaign = campaignSnap.data();
    if (campaign?.status !== "draft" && campaign?.status !== "paused") {
      return res.status(400).json({ error: "Can only clear lists of draft or paused campaigns." });
    }

    const recipientsSnap = await adminDb.collection("campaignRecipients")
      .where("campaignId", "==", campaignId)
      .get();
    
    // Batch delete
    let batch = adminDb.batch();
    let batchCount = 0;

    recipientsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
      batchCount++;
      if (batchCount >= 400) {
        batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    });

    if (batchCount > 0) {
      await batch.commit();
    }

    // Update campaign totalRecipients to 0
    await campaignRef.update({
      totalRecipients: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: "All recipients for this campaign have been cleared." });
  } catch (error: any) {
    console.error("[Recipients API] Error clearing recipients:", error);
    res.status(500).json({ error: "Failed to clear recipients", details: error?.message });
  }
});

export default router;
