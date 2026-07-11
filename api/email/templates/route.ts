import express from "express";
import { adminDb } from "../../../src/lib/firebase-admin.js";
import admin from "../../../src/lib/firebase-admin.js";
import { requireAdminAuth } from "../../../src/lib/email-auth.js";

const router = express.Router();

// Apply superadmin auth middleware to all template routes
router.use(requireAdminAuth as express.RequestHandler);

/**
 * GET /api/email/templates
 * Fetch all templates
 */
router.get("/", async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const snapshot = await adminDb.collection("emailTemplates")
      .orderBy("createdAt", "desc")
      .get();
    
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(templates);
  } catch (error: any) {
    console.error("[Templates API] Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates", details: error?.message });
  }
});

/**
 * GET /api/email/templates/:id
 * Fetch single template details
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const docSnap = await adminDb.collection("emailTemplates").doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error: any) {
    console.error("[Templates API] Error fetching template details:", error);
    res.status(500).json({ error: "Failed to fetch template details", details: error?.message });
  }
});

/**
 * POST /api/email/templates
 * Create a new template
 */
router.post("/", async (req, res) => {
  const { name, subject, bodyHtml, bodyText } = req.body;
  
  if (!name || !bodyHtml) {
    return res.status(400).json({ error: "Template name and bodyHtml are required" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const templateId = adminDb.collection("emailTemplates").doc().id;
    const payload = {
      id: templateId,
      name,
      subject: subject || "",
      bodyHtml,
      bodyText: bodyText || "",
      createdBy: (req as any).adminEmail || "muhammadbilalrasheed78@gmail.com",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await adminDb.collection("emailTemplates").doc(templateId).set(payload);
    res.status(211).json({ success: true, template: payload });
  } catch (error: any) {
    console.error("[Templates API] Error creating template:", error);
    res.status(500).json({ error: "Failed to create template", details: error?.message });
  }
});

/**
 * PUT /api/email/templates/:id
 * Update template details
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, subject, bodyHtml, bodyText } = req.body;

  if (!name || !bodyHtml) {
    return res.status(400).json({ error: "Template name and bodyHtml are required" });
  }

  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const templateRef = adminDb.collection("emailTemplates").doc(id);
    const templateSnap = await templateRef.get();

    if (!templateSnap.exists) {
      return res.status(404).json({ error: "Template not found" });
    }

    const payload = {
      name,
      subject: subject || "",
      bodyHtml,
      bodyText: bodyText || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await templateRef.update(payload);
    res.json({ success: true, template: { ...templateSnap.data(), ...payload } });
  } catch (error: any) {
    console.error("[Templates API] Error updating template:", error);
    res.status(500).json({ error: "Failed to update template", details: error?.message });
  }
});

/**
 * DELETE /api/email/templates/:id
 * Delete a template (Only allowed if template is not in use by any campaign)
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!adminDb) return res.status(503).json({ error: "Database not available" });

  try {
    const templateRef = adminDb.collection("emailTemplates").doc(id);
    const templateSnap = await templateRef.get();

    if (!templateSnap.exists) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Check if any campaign is using this template
    const inUseCampaigns = await adminDb.collection("campaigns")
      .where("templateId", "==", id)
      .limit(1)
      .get();
    
    if (!inUseCampaigns.empty) {
      return res.status(400).json({ 
        error: "Cannot delete template: It is currently active/selected in one or more campaigns." 
      });
    }

    await templateRef.delete();
    res.json({ success: true, message: "Template deleted successfully." });
  } catch (error: any) {
    console.error("[Templates API] Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template", details: error?.message });
  }
});

export default router;
