// src/data/ingredients.ts — Phase 1 AI Engine
// Pure rule-based safety analysis. No model download. Works offline instantly.
// Focused on ingredients commonly found in Nigerian food/drink/medicine markets.

export interface Finding {
  name:        string;
  codes:       string[];
  risk:        "high" | "medium" | "low";
  reason:      string;
  type:        "danger" | "caution";
  matchedCode?: string;
}

export interface UserProfile {
  allergies?:   string[];
  medications?: string[];
}

export interface ScanResult {
  score:         number;
  grade:         "A" | "B" | "C" | "D" | "F";
  findings:      Finding[];
  allergyAlerts: string[];
  positives:     string[];
}

// ── Dangerous — high deductions ─────────────────────────────
export const DANGEROUS: Finding[] = [
  {
    name: "Sodium Nitrite",
    codes: ["e250", "sodium nitrite", "nitrite"],
    risk: "high", type: "danger",
    reason: "Forms cancer-causing nitrosamines when cooked at high heat. Linked to colorectal cancer. Very common in processed meats and some Nigerian sausages.",
  },
  {
    name: "Sodium Nitrate",
    codes: ["e251", "sodium nitrate", "nitrate"],
    risk: "high", type: "danger",
    reason: "Converts to nitrite inside the body. Same colorectal cancer risk. Common in cured and smoked meats.",
  },
  {
    name: "Potassium Bromate",
    codes: ["e924", "potassium bromate"],
    risk: "high", type: "danger",
    reason: "BANNED in EU, UK, Canada. Known animal carcinogen. Still illegally used in some Nigerian flour and bread products. Always report products containing this.",
  },
  {
    name: "BHA (Butylated Hydroxyanisole)",
    codes: ["e320", "bha", "butylated hydroxyanisole"],
    risk: "high", type: "danger",
    reason: "IARC Group 2B possible human carcinogen. Endocrine disruptor. Banned for food use in Japan.",
  },
  {
    name: "BHT (Butylated Hydroxytoluene)",
    codes: ["e321", "bht", "butylated hydroxytoluene"],
    risk: "medium", type: "danger",
    reason: "Possible carcinogen. Endocrine disruptor. More harmful to children. Common in cereal packaging coatings that migrate into food.",
  },
  {
    name: "TBHQ",
    codes: ["e319", "tbhq", "tertiary butylhydroquinone"],
    risk: "high", type: "danger",
    reason: "Immune system disruption. Vision problems at high doses. Extremely common in cheap Nigerian snacks and instant noodles.",
  },
  {
    name: "Propyl Gallate",
    codes: ["e310", "propyl gallate"],
    risk: "medium", type: "danger",
    reason: "Endocrine disruptor. Possible estrogenic effects. Used to preserve fats and oils in processed foods.",
  },
  {
    name: "Partially Hydrogenated Oil (Trans Fat)",
    codes: [
      "partially hydrogenated",
      "trans fat",
      "hydrogenated vegetable oil",
      "hydrogenated fat",
      "hydrogenated palm",
      "hydrogenated soybean",
    ],
    risk: "high", type: "danger",
    reason: "Dramatically increases heart disease risk. WHO has called for global elimination by 2023. Still found in some Nigerian baked goods and cheap spreads.",
  },
  {
    name: "Tartrazine (E102 / Yellow 5)",
    codes: ["e102", "tartrazine", "yellow 5", "fd&c yellow 5", "ci 19140"],
    risk: "medium", type: "danger",
    reason: "Hyperactivity in children. Triggers migraines. Banned in Norway and Austria. Very common in Nigerian sweets, drinks, and snacks.",
  },
  {
    name: "Sunset Yellow (E110 / Yellow 6)",
    codes: ["e110", "sunset yellow", "orange yellow s", "fd&c yellow 6", "yellow 6"],
    risk: "medium", type: "danger",
    reason: "Hyperactivity in children. Causes hives and allergic reactions in sensitive individuals.",
  },
  {
    name: "Allura Red (E129 / Red 40)",
    codes: ["e129", "allura red", "red 40", "fd&c red 40"],
    risk: "medium", type: "danger",
    reason: "Hyperactivity in children. Possible carcinogen under EU review. Common in red-coloured beverages.",
  },
  {
    name: "Erythrosine (E127 / Red 3)",
    codes: ["e127", "erythrosine", "red 3", "fd&c red 3"],
    risk: "medium", type: "danger",
    reason: "Caused thyroid tumours in animal studies. Banned in cosmetics in the US. Still permitted in some foods.",
  },
  {
    name: "Carrageenan",
    codes: ["e407", "carrageenan"],
    risk: "medium", type: "danger",
    reason: "Causes intestinal inflammation and ulceration. May worsen IBS and Crohn's disease. Common in dairy alternatives and infant formula.",
  },
  {
    name: "High Fructose Corn Syrup",
    codes: [
      "high fructose corn syrup",
      "hfcs",
      "glucose-fructose syrup",
      "corn syrup",
      "isoglucose",
    ],
    risk: "medium", type: "danger",
    reason: "Strongly linked to obesity, insulin resistance, and non-alcoholic fatty liver disease. Common in cheap Nigerian carbonated drinks.",
  },
  {
    name: "Caramel Colour IV (E150d)",
    codes: ["e150d", "caramel colour iv", "caramel color iv", "ammonia sulfite caramel"],
    risk: "medium", type: "danger",
    reason: "Contains 4-MEI, a possible carcinogen formed during manufacturing. Common in dark cola drinks.",
  },
];

// ── Caution — smaller deductions ────────────────────────────
export const CAUTION: Finding[] = [
  {
    name: "MSG (E621)",
    codes: ["e621", "msg", "monosodium glutamate", "glutamate"],
    risk: "low", type: "caution",
    reason: "Generally safe at normal dietary doses. Some people report headaches or flushing (MSG symptom complex). Avoid in very high amounts.",
  },
  {
    name: "Aspartame (E951)",
    codes: ["e951", "aspartame", "nutrasweet", "equal"],
    risk: "medium", type: "caution",
    reason: "IARC classified as possibly carcinogenic (2023). MUST AVOID if you have PKU (phenylketonuria). Ongoing safety review.",
  },
  {
    name: "Saccharin (E954)",
    codes: ["e954", "saccharin", "sweet n low"],
    risk: "low", type: "caution",
    reason: "Long-term effects not fully studied. Some evidence of bladder irritation. Avoid during pregnancy.",
  },
  {
    name: "Acesulfame-K (E950)",
    codes: ["e950", "acesulfame", "ace-k", "acesulfame potassium"],
    risk: "low", type: "caution",
    reason: "May disrupt gut microbiome and have metabolic effects. Common in diet drinks.",
  },
  {
    name: "Sodium Benzoate (E211)",
    codes: ["e211", "sodium benzoate", "benzoate"],
    risk: "low", type: "caution",
    reason: "Reacts with Vitamin C to form benzene (a carcinogen). Common in soft drinks — check if Vitamin C is also listed.",
  },
  {
    name: "Polysorbate 80 (E433)",
    codes: ["e433", "polysorbate 80", "tween 80"],
    risk: "low", type: "caution",
    reason: "May alter gut microbiome and increase intestinal permeability. Used as an emulsifier in ice cream and baked goods.",
  },
  {
    name: "Disodium Inosinate (E631)",
    codes: ["e631", "disodium inosinate"],
    risk: "low", type: "caution",
    reason: "Gout sufferers should avoid — high in purines. Usually paired with MSG to amplify flavour in snacks.",
  },
  {
    name: "Sulfites (E220–E228)",
    codes: ["e220", "e221", "e222", "e223", "e224", "sulfite", "sulphite", "sulfur dioxide", "metabisulfite"],
    risk: "low", type: "caution",
    reason: "Triggers asthma attacks and allergic reactions in sulfite-sensitive individuals (approx 1% of population).",
  },
  {
    name: "Carnauba Wax (E903)",
    codes: ["e903", "carnauba wax"],
    risk: "low", type: "caution",
    reason: "Generally safe but used as a coating on fruits and confectionery that may indicate heavy processing.",
  },
];

// ── Positive nutrients to highlight ─────────────────────────
const POSITIVES = [
  "vitamin a", "vitamin b1", "vitamin b2", "vitamin b3", "vitamin b6",
  "vitamin b12", "vitamin c", "vitamin d", "vitamin d3", "vitamin e",
  "vitamin k", "folic acid", "folate", "calcium", "iron", "zinc",
  "magnesium", "potassium", "selenium", "phosphorus", "iodine",
  "omega-3", "omega 3", "dha", "epa", "fibre", "fiber",
  "probiotic", "prebiotic",
];

// ── Core analysis function ───────────────────────────────────
export function analyzeIngredients(
  text: string,
  profile?: UserProfile
): ScanResult {
  // Not enough text to analyse
  if (!text || text.trim().length < 5) {
    return { score: 50, grade: "C", findings: [], allergyAlerts: [], positives: [] };
  }

  const lower    = text.toLowerCase();
  const findings: Finding[] = [];
  const seen     = new Set<string>();
  let   score    = 100;

  // Check dangerous ingredients
  for (const item of DANGEROUS) {
    const match = item.codes.find((c) => lower.includes(c));
    if (match && !seen.has(item.name)) {
      seen.add(item.name);
      score -= item.risk === "high" ? 22 : item.risk === "medium" ? 13 : 6;
      findings.push({ ...item, matchedCode: match });
    }
  }

  // Check caution ingredients
  for (const item of CAUTION) {
    const match = item.codes.find((c) => lower.includes(c));
    if (match && !seen.has(item.name)) {
      seen.add(item.name);
      score -= item.risk === "medium" ? 8 : 4;
      findings.push({ ...item, matchedCode: match });
    }
  }

  // Check personal allergies
  const allergyAlerts: string[] = [];
  if (profile?.allergies) {
    for (const a of profile.allergies) {
      if (lower.includes(a.toLowerCase())) {
        allergyAlerts.push(a);
        score -= 30; // heavy penalty — this is a direct health risk
      }
    }
  }

  // Find positive nutrients
  const positives = POSITIVES
    .filter((p) => lower.includes(p))
    .map((p) => p.replace(/\b\w/g, (c) => c.toUpperCase()))
    .slice(0, 5);

  const s = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: s,
    grade: s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 35 ? "D" : "F",
    findings,
    allergyAlerts,
    positives,
  };
}