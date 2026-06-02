// src/data/ingredients.ts

export interface IngredientEntry {
  name: string;
  codes: string[];
  risk: "high" | "medium" | "low";
  reason: string;
  type: "danger" | "caution" | "info";
}

// Phase 1: Core Database of harmful additives commonly found in the market
export const DANGEROUS: IngredientEntry[] = [
  { name: "Sodium Nitrite", codes: ["e250", "sodium nitrite"], risk: "high",
    reason: "Linked to colorectal cancer. Common in processed meats.", type: "danger" },
  { name: "Potassium Bromate", codes: ["e924", "potassium bromate"], risk: "high",
    reason: "Banned in EU and UK. Still used in some local flour. Animal carcinogen.", type: "danger" },
  { name: "BHA", codes: ["e320", "bha", "butylated hydroxyanisole"], risk: "high",
    reason: "Possible human carcinogen. Endocrine disruptor.", type: "danger" },
  { name: "BHT", codes: ["e321", "bht", "butylated hydroxytoluene"], risk: "medium",
    reason: "Endocrine disruptor. Affects children more severely.", type: "danger" },
  { name: "TBHQ", codes: ["e319", "tbhq", "tertiary butylhydroquinone"], risk: "high",
    reason: "Immune system effects. Linked to vision disturbances at high doses.", type: "danger" },
  { name: "Tartrazine", codes: ["e102", "tartrazine", "fd&c yellow 5", "yellow 5"], risk: "medium",
    reason: "Hyperactivity in children. Banned in several countries.", type: "danger" },
  { name: "Sunset Yellow", codes: ["e110", "sunset yellow", "orange yellow s"], risk: "medium",
    reason: "Hyperactivity. Banned in some countries for children under 6.", type: "danger" },
];

export const CAUTION: IngredientEntry[] = [
  { name: "MSG", codes: ["e621", "msg", "monosodium glutamate"], risk: "low",
    reason: "Generally safe. Some people report sensitivity at high doses.", type: "caution" },
  { name: "Aspartame", codes: ["e951", "aspartame"], risk: "low",
    reason: "Avoid if phenylketonuria (PKU). IARC classified as 'possibly carcinogenic' in 2023.", type: "caution" },
  { name: "High Fructose Corn Syrup", codes: ["hfcs", "high fructose", "glucose-fructose"], risk: "medium",
    reason: "Linked to obesity, insulin resistance. Common in cheap products.", type: "caution" },
  { name: "Carrageenan", codes: ["e407", "carrageenan"], risk: "low",
    reason: "May cause gut inflammation in sensitive individuals.", type: "caution" },
];

export interface UserProfile {
  allergies?: string[];
}

export interface ScanResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: Array<IngredientEntry & { matchedCode: string }>;
  allergyAlerts: string[];
}

// The core algorithm that scores products in milliseconds
export function analyzeIngredients(
  ingredientText: string,
  profile?: UserProfile
): ScanResult {
  const lower = ingredientText.toLowerCase();
  const findings: ScanResult["findings"] = [];
  const allergyAlerts: string[] = [];
  let score = 100;

  // 1. Scan for highly dangerous ingredients
  for (const item of DANGEROUS) {
    const match = item.codes.find((c) => lower.includes(c));
    if (match) {
      score -= item.risk === "high" ? 22 : 12;
      findings.push({ ...item, matchedCode: match });
    }
  }

  // 2. Scan for cautionary ingredients
  for (const item of CAUTION) {
    const match = item.codes.find((c) => lower.includes(c));
    if (match) {
      score -= 6;
      findings.push({ ...item, matchedCode: match });
    }
  }

  // 3. Check against personal user allergies
  if (profile?.allergies) {
    for (const allergy of profile.allergies) {
      if (lower.includes(allergy.toLowerCase())) {
        allergyAlerts.push(allergy);
        score -= 30; // Massive penalty for direct allergen match
      }
    }
  }

  // 4. Calculate final letter grade
  const finalScore = Math.max(0, score);
  return {
    score: finalScore,
    grade: finalScore >= 85 ? "A" : finalScore >= 70 ? "B"
         : finalScore >= 55 ? "C" : finalScore >= 35 ? "D" : "F",
    findings,
    allergyAlerts,
  };
}