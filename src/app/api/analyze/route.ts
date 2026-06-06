// src/app/api/analyze/route.ts
import { NextResponse }        from "next/server";
import { GoogleGenerativeAI }  from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Cap ingredient text to avoid slow prompts and Vercel timeout
const MAX_TEXT = 3500;

// ── Timeout wrapper ──────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Prompt builder ────────────────────────────────────────────
function buildPrompt(
  text: string,
  profile?: { allergies?: string[]; conditions?: string[]; aboutMe?: string }
): string {
  const trimmed = text.slice(0, MAX_TEXT);
  return `You are a strict nutritionist and food safety expert analysing a product label for a Nigerian consumer.

Scanned ingredient text:
"${trimmed}"

User health profile:
- Allergies: ${profile?.allergies?.join(", ") || "None"}
- Medical conditions: ${profile?.conditions?.join(", ") || "None"}
- Health goals / about me: ${profile?.aboutMe || "None specified"}

STRICT RULES:
1. If the user has "Health goals / about me", explicitly tailor the reason for each finding to those goals.
2. allergyAlerts: ONLY include allergens that exactly match the user Allergies list. If allergies = "None", return [].
3. Score 0-100: start at 100, deduct 20 for each high-risk finding, 10 for medium, 5 for low.
4. Grade: A=85-100, B=70-84, C=55-69, D=35-54, F=0-34.
5. Return ONLY raw JSON. No markdown, no backticks, no explanation outside the JSON.

Required JSON:
{
  "score": number,
  "grade": "A"|"B"|"C"|"D"|"F",
  "findings": [
    {
      "name": "Exact ingredient name",
      "risk": "high"|"medium"|"low",
      "reason": "Scientific reason, tailored to user goals if provided.",
      "type": "danger"|"caution"
    }
  ],
  "positives": ["Full sentence describing a health benefit or how this ingredient supports user goals."],
  "allergyAlerts": ["Allergen name — ONLY if it matches the user Allergies profile. Empty array [] if no match."]
}`;
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { text, profile } = body as { text?: string; profile?: any };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "No ingredient text provided." }, { status: 400 });
    }

    const prompt = buildPrompt(text, profile);
    let aiText   = "";
    let aiSource = "";

    // ── Attempt 1: Gemini 2.5 Flash Lite ────────────────────
    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite",
        generationConfig: { temperature: 0 } // Locks down the AI to be 100% deterministic
      });
        const result = await withTimeout(model.generateContent(prompt), 22000, "Gemini 2.5 Flash Lite");
        aiText   = result.response.text().trim();
        aiSource = "gemini-2.5-flash-lite";
        console.log("✅ Gemini 2.5 Flash Lite succeeded");
      } catch (e1: any) {
        console.warn("⚠️  Gemini 2.5 Flash Lite failed:", e1.message);

        // ── Attempt 2: Gemini 1.5 Flash (stable) ──────────
        try {
          const model2  = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { temperature: 0 } });
          const result2 = await withTimeout(model2.generateContent(prompt), 18000, "Gemini 1.5 Flash");
          aiText   = result2.response.text().trim();
          aiSource = "gemini-1.5-flash";
          console.log("✅ Gemini 1.5 Flash succeeded");
        } catch (e2: any) {
          console.warn("⚠️  Gemini 1.5 Flash failed:", e2.message);
        }
      }
    }

    // ── Attempt 3: OpenRouter free tier ─────────────────────
    if (!aiText && process.env.OPENROUTER_API_KEY) {
      console.log("🔄 Falling back to OpenRouter...");
      try {
        const orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type":  "application/json",
            "HTTP-Referer":  "https://safelens-ai.vercel.app",
            "X-Title":       "SafeLens AI",
          },
          body:   JSON.stringify({
            model:    "meta-llama/llama-3.1-8b-instruct:free",
            temperature: 0,
            messages: [
              { role: "system", content: "You are a strict JSON-only API. Return raw valid JSON only. No markdown, no backticks." },
              { role: "user",   content: prompt },
            ],
          }),
          signal: AbortSignal.timeout(25000),
        });

        if (!orResp.ok) {
          const errTxt = await orResp.text().catch(() => orResp.statusText);
          throw new Error(`OpenRouter ${orResp.status}: ${errTxt.slice(0, 200)}`);
        }

        const orData = await orResp.json();
        aiText   = orData?.choices?.[0]?.message?.content?.trim() ?? "";
        aiSource = "openrouter-llama-3.1-8b";
        console.log("✅ OpenRouter succeeded");
      } catch (e3: any) {
        console.error("❌ OpenRouter failed:", e3.message);
      }
    }

    // ── All engines exhausted ────────────────────────────────
    if (!aiText) {
      return NextResponse.json(
        { error: "All AI engines are unavailable. Check GEMINI_API_KEY and OPENROUTER_API_KEY in Vercel environment variables." },
        { status: 503 }
      );
    }

    // ── Extract JSON from response ───────────────────────────
    // The AI sometimes wraps JSON in markdown code blocks — strip those first
    const cleaned   = aiText.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Non-JSON from", aiSource, ":", aiText.slice(0, 300));
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // ── Guarantee required fields always exist ───────────────
    analysis.allergyAlerts = Array.isArray(analysis.allergyAlerts) ? analysis.allergyAlerts : [];
    analysis.findings      = Array.isArray(analysis.findings)      ? analysis.findings      : [];
    analysis.positives     = Array.isArray(analysis.positives)     ? analysis.positives     : [];
    analysis.score         = typeof analysis.score === "number"    ? Math.round(Math.max(0, Math.min(100, analysis.score))) : 50;
    analysis.grade         = ["A","B","C","D","F"].includes(analysis.grade) ? analysis.grade : "C";

    // Sanitise each finding to ensure consistent shape
    analysis.findings = analysis.findings.map((f: any) => ({
      name:   typeof f.name   === "string" ? f.name   : "Unknown",
      risk:   ["high","medium","low"].includes(f.risk) ? f.risk : "low",
      reason: typeof f.reason === "string" ? f.reason : "",
      type:   ["danger","caution"].includes(f.type)   ? f.type : "caution",
    }));

    console.log(`✅ Analysis done via ${aiSource} — score: ${analysis.score}, grade: ${analysis.grade}, findings: ${analysis.findings.length}`);
    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error("Critical error in /api/analyze:", error);
    return NextResponse.json(
      { error: error?.message ?? "Unknown server error. Please try again." },
      { status: 500 }
    );
  }
}