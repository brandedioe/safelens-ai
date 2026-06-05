// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API using your secret key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, profile } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // This is the master prompt that turns the AI into a Nigerian health expert
    const prompt = `
      You are an expert nutritionist and toxicologist analyzing a product label for a Nigerian consumer.
      The OCR scanned these ingredients/text: "${text}"
      
      The user has this health profile:
      - Allergies: ${profile?.allergies?.join(", ") || "None"}
      - Medical Conditions: ${profile?.conditions?.join(", ") || "None"}
      
      Analyze the ingredients and return ONLY a valid JSON object matching this exact structure:
      {
        "score": number (0 to 100, where 100 is perfectly healthy),
        "grade": string ("A", "B", "C", "D", or "F"),
        "findings": [
          { "name": "Ingredient name", "risk": "high" | "medium" | "low", "reason": "Why it's bad", "type": "danger" | "caution" }
        ],
        "positives": ["Bullet point of health benefit to the body", "Another benefit"],
        "allergyAlerts": ["Name of specific allergen found matching their profile"]
      }

      Focus heavily on benefits to the body (positives), but strictly flag dangers (findings) based on their specific medical conditions.
      Return ONLY raw JSON. No markdown, no backticks, no explanations.
    `;

    // Use Gemini 1.5 Flash for the fastest response time
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    
    // Clean the response in case the AI wraps it in markdown blocks
    let aiText = result.response.text().trim();
    if (aiText.startsWith("```json")) {
      aiText = aiText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (aiText.startsWith("```")) {
      aiText = aiText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const analysis = JSON.parse(aiText);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: "Failed to analyze ingredients" }, { status: 500 });
  }
}