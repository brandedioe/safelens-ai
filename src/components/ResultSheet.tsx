"use client";
import { useState } from "react";
import { X, ShieldCheck, AlertTriangle, Flag, Pill, Sparkles } from "lucide-react";
import { shareOnWhatsApp } from "@/lib/whatsapp";
import { submitReport }    from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────
interface Finding {
  name:   string;
  risk:   "high" | "medium" | "low";
  reason: string;
  type:   "danger" | "caution";
}

interface DrugAlert {
  drug:       string;
  ingredient: string;
  severity:   "high" | "medium" | "low";
  message:    string;
}

interface Analysis {
  score:         number;
  grade:         string;
  findings:      Finding[];
  allergyAlerts: string[];
  positives?:    string[];
}

interface Props {
  result: {
    barcode:     string;
    product:     { name?: string; brand?: string; ingredients?: string } | null;
    analysis:    Analysis;
    drugAlerts?: DrugAlert[];
    ts:          number;
  };
  onClose: () => void;
}

// ─── Colour maps ──────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: "#10B981", B: "#34D399", C: "#FBBF24", D: "#F97316", F: "#EF4444",
};

const RISK_STYLE: Record<string, { bg: string; fg: string }> = {
  high:   { bg: "#FEE2E2", fg: "#991B1B" },
  medium: { bg: "#FEF3C7", fg: "#92400E" },
  low:    { bg: "#F3F4F6", fg: "#374151" },
};

const DRUG_CLASSES: Record<string, { wrap: string; text: string }> = {
  high:   { wrap: "bg-red-50    border-red-200",    text: "text-red-700"    },
  medium: { wrap: "bg-orange-50 border-orange-200", text: "text-orange-700" },
  low:    { wrap: "bg-yellow-50 border-yellow-200", text: "text-yellow-700" },
};

// ─── Component ────────────────────────────────────────────────
export default function ResultSheet({ result, onClose }: Props) {
  const [showReport, setShowReport] = useState(false);
  const [reportDesc, setReportDesc] = useState("");
  const [reportMkt,  setReportMkt]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const { product, drugAlerts = [] } = result;

  // ── Defensive: ensure analysis fields always exist ─────────
  const analysis: Analysis = {
    score:         typeof result.analysis?.score  === "number" ? result.analysis.score  : 50,
    grade:         ["A","B","C","D","F"].includes(result.analysis?.grade ?? "") ? result.analysis.grade : "C",
    findings:      Array.isArray(result.analysis?.findings)      ? result.analysis.findings      : [],
    allergyAlerts: Array.isArray(result.analysis?.allergyAlerts) ? result.analysis.allergyAlerts : [],
    positives:     Array.isArray(result.analysis?.positives)     ? result.analysis.positives     : [],
  };

  const color    = GRADE_COLOR[analysis.grade]  ?? "#FBBF24";
  const hasDrug  = drugAlerts.length > 0;
  const isOCR    = result.barcode === "ocr-scan";

  // ── Submit fake report ─────────────────────────────────────
  async function submitFakeReport() {
    if (!reportDesc.trim()) return;
    setSubmitting(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      if (navigator.geolocation) {
        await new Promise<void>(res => {
          navigator.geolocation.getCurrentPosition(
            pos => { lat = pos.coords.latitude; lng = pos.coords.longitude; res(); },
            ()  => res(),
            { timeout: 5000 }
          );
        });
      }
      await submitReport({
        product_barcode: result.barcode,
        product_name:    product?.name ?? result.barcode,
        description:     reportDesc.trim(),
        market_name:     reportMkt.trim(),
        lat, lng,
      });
      setSubmitted(true);
    } catch {
      alert("Could not submit report. Check your Supabase configuration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[88vh] bg-[#F8FAFC] rounded-t-2xl overflow-y-auto"
        style={{ animation: "slideUp 0.22s ease-out" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* ── Score + product row ── */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
            style={{ background: color }}
          >
            {analysis.score}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {product?.name ?? (isOCR ? "Label Scan" : `Barcode: ${result.barcode}`)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {product?.brand ?? (isOCR ? "OCR scan" : "Unknown brand")}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* ── Grade + NAFDAC pill row ── */}
        <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
          {/* Letter grade */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: color + "22" }}
          >
            <span className="text-xl font-black leading-none" style={{ color }}>
              {analysis.grade}
            </span>
            <span className="text-xs font-semibold" style={{ color }}>Grade</span>
          </div>

          {/* NAFDAC nudge */}
          {!isOCR && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#003366] text-white">
              <ShieldCheck size={11} /> Use NAFDAC # tab to verify
            </span>
          )}

          {/* AI badge */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
            <Sparkles size={11} /> Gemini AI
          </span>
        </div>

        {/* ── Drug interaction alerts (highest priority) ── */}
        {hasDrug && (
          <div className="mx-4 mb-3 flex flex-col gap-2">
            {drugAlerts.map((d, i) => {
              const cls = DRUG_CLASSES[d.severity] ?? DRUG_CLASSES.medium;
              return (
                <div key={i} className={`p-3 rounded-xl border ${cls.wrap}`}>
                  <p className={`text-xs font-bold mb-1 flex items-center gap-1 ${cls.text}`}>
                    <Pill size={12} />
                    DRUG INTERACTION — {d.drug}
                    <span className="ml-auto uppercase text-[10px]">{d.severity}</span>
                  </p>
                  <p className={`text-xs leading-relaxed ${cls.text}`}>{d.message}</p>
                  <p className={`text-[10px] mt-1 opacity-70 ${cls.text}`}>
                    Triggered by: <strong>{d.ingredient}</strong> in this product
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Allergy alerts ── */}
        {analysis.allergyAlerts.length > 0 && (
          <div className="mx-4 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-bold text-red-700 mb-1.5 flex items-center gap-1">
              <AlertTriangle size={12} /> ALLERGY ALERT — Matches your profile
            </p>
            {analysis.allergyAlerts.map(a => (
              <p key={a} className="text-xs text-red-600">• {a} detected in ingredients</p>
            ))}
          </div>
        )}

        {/* ── Flagged ingredients ── */}
        {analysis.findings.length > 0 ? (
          <div className="px-4 mb-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Flagged Ingredients ({analysis.findings.length})
            </p>
            <div className="flex flex-col gap-2">
              {analysis.findings.map((f, i) => {
                const s = RISK_STYLE[f.risk ?? "low"] ?? RISK_STYLE.low;
                return (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: s.bg, color: s.fg }}
                      >
                        {(f.risk ?? "low").toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">
                        {f.name ?? "Unknown ingredient"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {f.reason ?? "No additional information."}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // All-clear card
          <div className="mx-4 mb-3 p-3 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
              <Sparkles size={11} /> No dangerous additives detected
            </p>
            <p className="text-xs text-green-600 mt-0.5 leading-relaxed">
              Gemini AI found no flagged ingredients in this product based on current safety databases.
            </p>
          </div>
        )}

        {/* ── Positive nutrients ── */}
        {(analysis.positives?.length ?? 0) > 0 && (
          <div className="px-4 mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Nutrients &amp; Benefits
            </p>
            <div className="flex flex-col gap-1.5">
              {analysis.positives!.map((p, i) => (
                <p key={i} className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Fake product report form ── */}
        {showReport && (
          <div className="mx-4 mb-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
            {submitted ? (
              <div className="text-center py-3">
                <p className="text-green-600 font-semibold text-sm">✓ Report submitted</p>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                  Thank you for protecting Nigerian consumers. Our team will review this.
                </p>
                <button
                  onClick={() => { setShowReport(false); setSubmitted(false); }}
                  className="mt-3 text-xs text-gray-500 underline"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                  <Flag size={14} className="text-red-500" />
                  Report this product as fake / unsafe
                </p>
                <input
                  value={reportMkt}
                  onChange={e => setReportMkt(e.target.value)}
                  placeholder="Where did you buy it? (market name, area)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-400 mb-2 bg-white"
                />
                <textarea
                  value={reportDesc}
                  onChange={e => setReportDesc(e.target.value)}
                  placeholder="Describe the issue (e.g. packaging different, wrong colour, unusual smell, expired)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-400 mb-3 bg-white resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReport(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitFakeReport}
                    disabled={submitting || !reportDesc.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white disabled:opacity-40"
                  >
                    {submitting ? "Submitting…" : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex gap-2 px-4 mb-2">
          <button
            onClick={() => shareOnWhatsApp({ barcode: result.barcode, product, analysis })}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "#25D366", color: "#fff" }}
          >
            {/* Official WhatsApp icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share on WhatsApp
          </button>
          <button
            onClick={() => setShowReport(r => !r)}
            className="px-4 py-3 rounded-xl text-sm font-medium border border-red-200 text-red-500 flex items-center gap-1.5"
          >
            <Flag size={14} /> Fake
          </button>
        </div>

        {/* Bottom safe-area spacer */}
        <div className="h-6" />
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}