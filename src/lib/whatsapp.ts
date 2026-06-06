// src/lib/whatsapp.ts
// Builds a formatted WhatsApp message from a scan result and opens WhatsApp share.

interface ShareData {
  barcode:  string;
  product:  { name?: string; brand?: string } | null;
  analysis: {
    score:         number;
    grade:         string;
    findings:      Array<{ name: string; risk: string; type: string }>;
    allergyAlerts: string[];
  };
}

const GRADE_EMOJI: Record<string, string> = {
  A: "🟢", B: "🟢", C: "🟡", D: "🟠", F: "🔴",
};

export function buildShareMessage(data: ShareData): string {
  const name    = data.product?.name  ?? "Unknown Product";
  const brand   = data.product?.brand ? " by " + data.product.brand : "";
  const score   = typeof data.analysis.score === "number" ? data.analysis.score : 0;
  const grade   = data.analysis.grade ?? "?";
  const emoji   = GRADE_EMOJI[grade] ?? "⚪";

  const verdict =
    score >= 70 ? "Generally safe for consumption" :
    score >= 50 ? "Use with caution" :
    "AVOID — dangerous additives detected";

  const lines: string[] = [
    "🔍 *SafeLens AI Safety Scan*",
    "",
    "📦 *" + name + "*" + brand,
    emoji + " Safety Score: *" + score + "/100* — Grade *" + grade + "*",
    "",
  ];

  if ((data.analysis.allergyAlerts ?? []).length > 0) {
    lines.push("🚨 *ALLERGY ALERT:*");
    data.analysis.allergyAlerts.forEach(a => lines.push("• Contains " + a));
    lines.push("");
  }

  const dangers = (data.analysis.findings ?? []).filter(f => f.type === "danger").slice(0, 5);
  if (dangers.length > 0) {
    lines.push("⚠️ *Flagged Dangerous Additives:*");
    dangers.forEach(f => lines.push("• " + f.name + " (" + f.risk + " risk)"));
    const more = (data.analysis.findings ?? []).length - dangers.length;
    if (more > 0) lines.push("• +" + more + " more flagged ingredients");
    lines.push("");
  }

  lines.push(verdict);
  lines.push("");
  lines.push("_Scanned with SafeLens AI — Guardian of Nigerian Consumers_");
  lines.push("📲 Install free: https://safelens-ai.vercel.app");

  return lines.join("\n");
}

export function shareOnWhatsApp(data: ShareData): void {
  const text = buildShareMessage(data);
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
}