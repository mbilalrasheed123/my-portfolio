import { Request, Response, NextFunction } from "express";
import admin from "./firebase-admin.js";

export interface AuthenticatedRequest extends Request {
  adminEmail?: string;
}

/**
 * Middleware to verify that the request is sent by the authorized superadmin.
 * Authenticates via Firebase ID Token in the Authorization header.
 */
export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authorization header" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email || email !== "muhammadbilalrasheed78@gmail.com") {
      console.warn(`[AdminAuth] Access denied for user: ${email}`);
      return res.status(403).json({ error: "Forbidden: Superadmin access only" });
    }

    req.adminEmail = email;
    next();
  } catch (error: any) {
    console.error("[AdminAuth] Token verification failed:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token" });
  }
}
