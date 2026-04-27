import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

// MongoDB Setup
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "portfolio";
let db: any;

async function connectDB() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment variables");
    return;
  }
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("Connected to MongoDB Atlas");

    // Initialize settings if empty
    const settingsCount = await db.collection("settings").countDocuments();
    if (settingsCount === 0) {
      await db.collection("settings").insertOne({
        name: "Muhammad Bilal Rasheed",
        title: "Full Stack Developer",
        subtitle: "Building modern web applications with passion and precision.",
        email: "muhammadbilalrasheed78@gmail.com",
        aboutText: "I am a Website Developer / Full Stack dedicated to crafting digital solutions that balance technical complexity with human-centric design. My journey is defined by a relentless pursuit of excellence and a deep-seated passion for problem-solving.",
        experienceYears: "03+",
        education: "BS Computer Science",
        location: "Pakistan (Remote)"
      });
    }
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

// OTP Store (In-memory)
const otpStore: Record<string, { otp: string; expires: number }> = {};

async function startServer() {
  await connectDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to check DB connection
  app.use("/api/data", (req, res, next) => {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    next();
  });

  app.use("/api/settings", (req, res, next) => {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    next();
  });

  // --- AUTH ENDPOINTS ---

  app.post("/api/auth/request-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // 10 mins

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.warn("Email credentials not configured. OTP is:", otp);
      return res.json({ status: "skipped", message: "Email service not configured", otp }); // For demo
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: `"Portfolio Admin" <${user}>`,
        to: email,
        subject: "Your Portfolio Verification Code",
        text: `Your verification code is: ${otp}`,
      });
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Failed to send email:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("535-5.7.8")) {
        res.status(500).json({ 
          error: "Email authentication failed. Please ensure you are using a Gmail App Password, not your regular password." 
        });
      } else {
        res.status(500).json({ error: "Failed to send email. Please try again later." });
      }
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    const { email, otp, name } = req.body;
    const stored = otpStore[email];

    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    delete otpStore[email];

    try {
      let user = await db.collection("users").findOne({ email });

      if (!user) {
        user = {
          uid: Math.random().toString(36).substring(2, 15),
          email,
          displayName: name || email.split("@")[0],
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        await db.collection("users").insertOne(user);
      } else {
        await db.collection("users").updateOne(
          { email },
          { $set: { lastLogin: new Date().toISOString() } }
        );
        user = await db.collection("users").findOne({ email });
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // --- DATA ENDPOINTS ---

  app.get("/api/data/:collection", async (req, res) => {
    const { collection } = req.params;
    try {
      const items = await db.collection(collection).find({}).toArray();
      // Map _id to id for frontend compatibility
      const formattedItems = items.map((item: any) => ({
        ...item,
        id: item.id || item._id.toString()
      }));
      res.json(formattedItems);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/data/:collection", async (req, res) => {
    const { collection } = req.params;
    try {
      const newItem = {
        ...req.body,
        createdAt: new Date().toISOString(),
      };
      const result = await db.collection(collection).insertOne(newItem);
      res.json({ ...newItem, id: result.insertedId.toString() });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.put("/api/data/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    try {
      let query: any = { id: id };
      // Try to match by ObjectId if it looks like one
      if (ObjectId.isValid(id)) {
        query = { $or: [{ id: id }, { _id: new ObjectId(id) }] };
      }

      const updateData = { ...req.body, updatedAt: new Date().toISOString() };
      delete updateData._id;
      delete updateData.id;

      await db.collection(collection).updateOne(query, { $set: updateData });
      const updatedItem = await db.collection(collection).findOne(query);
      res.json({ ...updatedItem, id: updatedItem.id || updatedItem._id.toString() });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.delete("/api/data/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    try {
      let query: any = { id: id };
      if (ObjectId.isValid(id)) {
        query = { $or: [{ id: id }, { _id: new ObjectId(id) }] };
      }
      await db.collection(collection).deleteOne(query);
      res.json({ status: "ok" });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Special endpoint for settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await db.collection("settings").findOne({});
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const updateData = { ...req.body };
      delete updateData._id;
      await db.collection("settings").updateOne({}, { $set: updateData }, { upsert: true });
      const settings = await db.collection("settings").findOne({});
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Legacy notify endpoint
  app.post("/api/notify", async (req, res) => {
    const { to, subject, text } = req.body;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) return res.status(200).json({ status: "skipped" });

    const transporter = nodemailer.createTransport({ 
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass } 
    });
    try {
      await transporter.sendMail({ from: `"Portfolio Admin" <${user}>`, to, subject, text });
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Failed to send notification email:", error);
      res.status(500).json({ error: "Failed to send notification" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
