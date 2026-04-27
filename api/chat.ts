import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, messages, systemInstruction } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined
    });

    const chat = model.startChat({
      history: messages?.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })) || [],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("Gemini API Error details:", JSON.stringify(error, null, 2));
    
    let message = error.message || "Failed to generate response";
    if (error.status === 403 || message.includes("403") || message.includes("blocked")) {
      message = "Gemini API Access Blocked: The Generative Language API might not be enabled for your API key, or your key has IP/Referer restrictions. Please enable the 'Generative Language API' in your Google Cloud Console and ensure your API key allows access to it.";
    }
    
    return res.status(500).json({ error: message });
  }
}
