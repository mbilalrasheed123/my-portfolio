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
        console.log(`[Email Service] Email sent successfully to ${to}`);
        return res.json({ success: true, message: "Email sent" });
      } catch (error) {
        console.error(`[Email Service] Failed to send email:`, error);
        return res.status(500).json({ success: false, error: "Failed to send email" });
      }
    } else {
      console.warn(`[Email Service] SMTP credentials missing. Email NOT sent.`);
      console.log(`[Email Service] Recipient: ${to}`);
      console.log(`[Email Service] Subject: ${subject}`);
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
