import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;
    
    console.log(`[Email Service] Attempting to send email to ${to}`);
    console.log(`[Email Service] Subject: ${subject}`);
    
    // In a real scenario, use nodemailer with process.env.SMTP_USER etc.
    // For now, we log and return success to demonstrate the flow
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Bilal Portfolio" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text,
          html,
        });
        console.log(`[Email Service] Email sent successfully to ${to}`);
        return res.json({ success: true, message: "Email sent" });
      } catch (error) {
        console.error(`[Email Service] Failed to send email:`, error);
        return res.status(500).json({ success: false, error: "Failed to send email" });
      }
    } else {
      console.log(`[Email Service] SMTP credentials not found. Email content logged above.`);
      return res.json({ success: true, message: "Email logged (no SMTP config)" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
