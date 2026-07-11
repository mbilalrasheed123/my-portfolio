import nodemailer from "nodemailer";

/**
 * Sanitizes input text to prevent XSS / script injection.
 */
export function sanitizeText(val: string): string {
  if (!val) return val;
  return val
    // Remove <script>...</script> block tags completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove onX event handlers (e.g. onclick, onload, onerror, etc.)
    .replace(/\bon[a-z]+\s*=\s*(['"])(.*?)\1/gi, "")
    .replace(/\bon[a-z]+\s*=\s*([^\s>]+)/gi, "")
    // Remove javascript:, vbscript:, and data: schemes
    .replace(/(javascript|vbscript|data):/gi, "")
    // Strip other dangerous HTML tags
    .replace(/<\/?(iframe|embed|object|link|style|meta|html|body|applet)[^>]*>/gi, "")
    // Escape generic < and > characters
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Validates a single email address.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Parses a CSV string containing recipient information.
 * Supports:
 * - Simple "email" on each line
 * - "name,email" or "email,name" format
 * - Header lines like "Email,Name" or "Name,Email"
 */
export function parseRecipientsCSV(csvContent: string): { name: string; email: string }[] {
  if (!csvContent) return [];

  const lines = csvContent.split(/\r?\n/);
  const results: { name: string; email: string }[] = [];
  const seenEmails = new Set<string>();

  let emailIndex = -1;
  let nameIndex = -1;
  let hasHeaders = false;

  // Process first line to check for headers
  if (lines.length > 0) {
    const firstLineCols = lines[0].split(",").map(col => col.trim().toLowerCase());
    
    // Check if first line contains header keywords
    const isEmailHeader = (col: string) => col.includes("email") || col === "mail" || col === "e-mail";
    const isNameHeader = (col: string) => col.includes("name") || col === "fname" || col === "lname" || col === "fullname";

    const emailColIdx = firstLineCols.findIndex(isEmailHeader);
    const nameColIdx = firstLineCols.findIndex(isNameHeader);

    if (emailColIdx !== -1) {
      emailIndex = emailColIdx;
      nameIndex = nameColIdx;
      hasHeaders = true;
    }
  }

  const startRow = hasHeaders ? 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split CSV handling basic quotes if any
    const columns = line.split(",").map(col => col.replace(/^["']|["']$/g, "").trim());

    let email = "";
    let name = "";

    if (hasHeaders) {
      if (emailIndex !== -1 && emailIndex < columns.length) {
        email = columns[emailIndex];
      }
      if (nameIndex !== -1 && nameIndex < columns.length) {
        name = columns[nameIndex];
      }
    } else {
      // If no headers, try to auto-detect
      if (columns.length === 1) {
        email = columns[0];
      } else if (columns.length >= 2) {
        // Assume first valid email is the email, the other is name
        if (isValidEmail(columns[0])) {
          email = columns[0];
          name = columns[1];
        } else if (isValidEmail(columns[1])) {
          email = columns[1];
          name = columns[0];
        } else {
          // Default fallback
          name = columns[0];
          email = columns[1];
        }
      }
    }

    email = email.trim().toLowerCase();
    name = name.trim();

    if (email && isValidEmail(email) && !seenEmails.has(email)) {
      seenEmails.add(email);
      results.push({ name: name || email.split("@")[0], email });
    }
  }

  return results;
}
