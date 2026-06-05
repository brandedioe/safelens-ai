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
      You are an expert, strict nutritionist and toxicologist analyzing a product label.
      The OCR scanned these ingredients/text: "${text}"
      
      The user has this specific health profile:
      - Allergies: ${profile?.allergies?.join(", ") || "None"}
      - Medical Conditions: ${profile?.conditions?.join(", ") || "None"}
      - Personal Health/Dietary Goals (About Me): ${profile?.aboutMe || "None specified"}
      
      CRITICAL INSTRUCTION: If the user has specified "Personal Health/Dietary Goals", you MUST explicitly tailor your analysis to those goals. For example, if they want to gain weight, evaluate if the ingredients provide healthy caloric density or unhealthy empty calories.
      
      Analyze the ingredients and return ONLY a valid JSON object:
      {
        "score": number (0 to 100),
        "grade": string ("A", "B", "C", "D", or "F"),
        "findings": [
          { "name": "Ingredient name", "risk": "high" | "medium" | "low", "reason": "Scientific reason it is bad, explicitly mentioning how it helps or harms their 'About Me' goals.", "type": "danger" | "caution" }
        ],
        "positives": ["Actual health benefits or how it supports their 'About Me' goals. If none exist, output 'No significant nutritional benefits.'"],
        "allergyAlerts": ["Name of specific allergen found. STRICT RULE: You MUST ONLY include allergens explicitly listed in the user's profile. If their Allergies profile is 'None', this array MUST be empty []"]
      }

      Return ONLY raw JSON. No markdown, no backticks, no explanations.
    `;

    let aiText = "";

    try {
      // 1. ATTEMPT 1: Try Gemini 2.5 Flash Lite
      console.log("--- Attempting Gemini 2.5 Flash Lite ---");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const result = await model.generateContent(prompt);
      aiText = result.response.text().trim();
      console.log("✅ Gemini successfully handled the request!");

    } catch (geminiError: any) {
      // 2. ATTEMPT 2: Fallback Engine (OpenRouter - Llama 3 8B Free)
      console.warn("⚠️ Gemini Lite failed or exhausted. Switching to OpenRouter Free Fallback...");

      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("Gemini failed and no OPENROUTER_API_KEY was found in environment variables.");
      }

      const fallbackResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct:free",
          messages: [
            { role: "system", content: "You are a strict JSON-only AI. Output raw JSON format only. Do not wrap the JSON in backticks or markdown blocks." },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Both AI engines failed. OpenRouter status: ${fallbackResponse.status}`);
      }

      const fallbackData = await fallbackResponse.json();
      aiText = fallbackData.choices[0].message.content.trim();
      console.log("✅ OpenRouter Fallback successfully handled the request!");
    }
    
    // Bulletproof JSON extractor: Finds the first { and last } even if the AI adds weird text
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);

    // AI Safety Net: Force missing arrays to be empty arrays so the UI never crashes
    if (!analysis.allergyAlerts) analysis.allergyAlerts = [];
    if (!analysis.findings) analysis.findings = [];
    if (!analysis.positives) analysis.positives = [];

    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error("Critical AI Analysis Error:", error);
    // Temporarily return the exact error message to the frontend for debugging
    return NextResponse.json({ error: error?.message || "Unknown server error" }, { status: 500 });
  }
}