"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Users, Clock, Camera, AlertCircle, WifiOff } from "lucide-react";
import ResultSheet    from "./ResultSheet";
import FamilyProfiles from "./FamilyProfiles";
import ScanHistory    from "./ScanHistory";
import { checkDrugInteractions } from "@/lib/drugInteractions";
import { fetchByBarcode }         from "@/lib/openFoodFacts";
import { getCommunityProduct, saveCommunityProduct } from "@/lib/supabase";
import {
  cacheProduct, getCachedProduct, saveScan,
  getActiveProfile,
  type FamilyProfile,
} from "@/lib/storage";

type Mode = "barcode" | "nafdac" | "ocr" | "history" | "profiles";

// ─────────────────────────────────────────────────────────────
// Shared helper — calls /api/analyze and validates the result
// ─────────────────────────────────────────────────────────────
async function runAIAnalysis(
  text: string,
  profile?: { allergies?: string[]; conditions?: string[]; aboutMe?: string }
) {
  const response = await fetch("/api/analyze", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },   // ← required
    body:    JSON.stringify({ text: text || "No ingredient information available.", profile }),
  });

  const data = await response.json();

  // Surface AI-side errors so the UI can handle them
  if (!response.ok || data.error) {
    throw new Error(data.error ?? `AI service returned status ${response.status}`);
  }

  // Defensive: ensure required numeric fields are present
  return {
    score:         typeof data.score === "number" ? data.score : 50,
    grade:         ["A","B","C","D","F"].includes(data.grade) ? data.grade : "C",
    findings:      Array.isArray(data.findings)      ? data.findings      : [],
    allergyAlerts: Array.isArray(data.allergyAlerts) ? data.allergyAlerts : [],
    positives:     Array.isArray(data.positives)     ? data.positives     : [],
  };
}

// ─────────────────────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────────────────────
export default function AppShell() {
  const [mode, setMode]                        = useState<Mode>("barcode");
  const [result, setResult]                    = useState<any>(null);
  const [loading, setLoading]                  = useState(false);
  const [camErr, setCamErr]                    = useState(false);
  const [activeProfile, setActiveProfileState] = useState<FamilyProfile | null>(null);
  const scannerRef = useRef<any>(null);

  // Load active profile on mount
  useEffect(() => { getActiveProfile().then(p => setActiveProfileState(p)); }, []);

  // ── Camera ──────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    if (!scannerRef.current) return;
    try { await scannerRef.current.stop(); } catch {}
    scannerRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamErr(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("sl-camera");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 110 }, aspectRatio: 1.77 },
        async (decoded: string) => {
          await stopCamera();
          handleBarcode(decoded);
        },
        () => {}
      );
    } catch { setCamErr(true); }
  }, [stopCamera]);

  useEffect(() => {
    if (mode === "barcode" && !result) {
      const t = setTimeout(startCamera, 80);
      return () => { clearTimeout(t); stopCamera(); };
    }
    stopCamera();
  }, [mode, result]);

  useEffect(() => () => { stopCamera(); }, []);

  // ── Build profile payload for AI ────────────────────────────
  const aiProfile = activeProfile
    ? {
        allergies:  activeProfile.allergies,
        conditions: activeProfile.conditions,
        aboutMe:    activeProfile.aboutMe,
      }
    : undefined;

  // ── Barcode handler ─────────────────────────────────────────
  const handleBarcode = useCallback(async (barcode: string) => {
    setLoading(true);
    try {
      // 1. IndexedDB cache first
      let cached  = await getCachedProduct(barcode);
      let product = cached?.data ?? null;

      // 2. Supabase community DB → Open Food Facts
      if (!product) {
        const communityMatch = await getCommunityProduct(barcode);
        if (communityMatch?.ingredients_text) {
          product = {
            name:        communityMatch.name ?? "Community Product",
            brand:       "Community DB",
            ingredients: communityMatch.ingredients_text,
            found:       true,
          };
        } else {
          const fetched = await fetchByBarcode(barcode);
          if (fetched?.found) {
            await cacheProduct(barcode, fetched);
            product = fetched;
          }
        }
      }

      // 3. If product completely unknown, still run AI with a useful message
      const ingredientText = (product?.ingredients ?? "").trim();
      const textForAI = ingredientText
        || (product ? "Product found but ingredient list is not available."
                    : "Product not found in any database. No ingredient data.");

      // 4. Gemini AI analysis
      const analysis = await runAIAnalysis(textForAI, aiProfile);

      // 5. Drug interaction check (local, offline)
      const drugAlerts = checkDrugInteractions(
        activeProfile?.medications ?? [],
        ingredientText
      );

      // 6. Save compact record to history
      await saveScan(barcode, {
        score:         analysis.score,
        grade:         analysis.grade,
        productName:   product?.name  ?? `Barcode ${barcode}`,
        brand:         product?.brand ?? "",
        allergyAlerts: analysis.allergyAlerts,
        drugAlerts:    drugAlerts.map((d: any) => ({ drug: d.drug, severity: d.severity })),
      });

      // 7. Show result sheet
      setResult({
        barcode,
        product:    product ?? { name: `Barcode: ${barcode}`, brand: "Not found" },
        analysis,
        drugAlerts,
        ts: Date.now(),
      });

    } catch (e: any) {
      console.error("Barcode scan error:", e);
      // Silently restart scanner instead of an ugly alert — user can try again
      setTimeout(() => { if (mode === "barcode") startCamera(); }, 800);
    } finally {
      setLoading(false);
    }
  }, [activeProfile, mode, startCamera]);

  // ── OCR result handler ──────────────────────────────────────
  const handleOCRResult = useCallback(async (text: string) => {
    setLoading(true);
    try {
      // 1. AI analysis
      const analysis = await runAIAnalysis(text, aiProfile);

      // 2. Drug interactions
      const drugAlerts = checkDrugInteractions(activeProfile?.medications ?? [], text);

      // 3. Save to history ← THE CRITICAL FIX (was missing before)
      await saveScan("ocr-" + Date.now(), {
        score:         analysis.score,
        grade:         analysis.grade,
        productName:   "Label Scan",
        brand:         "OCR",
        allergyAlerts: analysis.allergyAlerts,
        drugAlerts:    drugAlerts.map((d: any) => ({ drug: d.drug, severity: d.severity })),
      });

      // 4. Silently contribute to community moat
      saveCommunityProduct("manual-ocr-" + Date.now(), text).catch(() => {});

      // 5. Show result
      setResult({
        barcode:  "ocr-scan",
        product:  { name: "Label Scan", brand: "OCR", ingredients: text },
        analysis,
        drugAlerts,
        ts: Date.now(),
      });

    } catch (e: any) {
      console.error("OCR analysis error:", e);
      alert(
        "AI analysis failed.\n\n" +
        (e.message?.includes("quota") || e.message?.includes("429")
          ? "Gemini quota reached. Try again in a moment."
          : e.message?.includes("fetch") || e.message?.includes("network")
          ? "No internet connection. Connect and try again."
          : (e.message ?? "Unknown error. Try again."))
      );
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  // ── Render ──────────────────────────────────────────────────
  const profileInitials = activeProfile?.name.slice(0, 2).toUpperCase() ?? null;

  return (
    <div className="app-height flex flex-col bg-[#07090F] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <Zap size={18} className="text-[#F59E0B]" />
        <span className="text-[11px] font-bold tracking-[3px] text-white">SAFELENS</span>
        <button
          onClick={() => setMode("profiles")}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: profileInitials ? "rgba(16,185,129,0.2)" : "#1A2235",
            border:     profileInitials ? "1.5px solid #10B981"  : "none",
          }}
        >
          {profileInitials
            ? <span className="text-[10px] font-bold text-[#10B981]">{profileInitials}</span>
            : <Users size={14} className="text-gray-600" />}
        </button>
      </div>

      {/* Active profile banner */}
      {activeProfile && (mode === "barcode" || mode === "ocr") && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-[#10B981] font-semibold flex-1 truncate">
            Scanning for {activeProfile.name}
            {activeProfile.allergies.length  > 0 && " · " + activeProfile.allergies.length  + " allergen"  + (activeProfile.allergies.length  !== 1 ? "s" : "") + " watched"}
            {activeProfile.medications.length > 0 && " · " + activeProfile.medications.length + " med"      + (activeProfile.medications.length !== 1 ? "s" : "") + " checked"}
          </span>
        </div>
      )}

      {/* Mode chips */}
      {(mode === "barcode" || mode === "nafdac" || mode === "ocr") && (
        <div className="flex gap-2 px-4 pb-3 flex-shrink-0">
          {(["barcode", "nafdac", "ocr"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setResult(null); setMode(m); }}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                mode === m ? "bg-[#10B981] text-white" : "bg-[#1A2235] text-gray-500",
              ].join(" ")}
            >
              {m === "barcode" ? "Barcode" : m === "nafdac" ? "NAFDAC #" : "OCR Label"}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 relative overflow-hidden px-3">

        {/* ─ Barcode camera ─ */}
        {mode === "barcode" && (
          <div className="absolute inset-3 rounded-xl overflow-hidden bg-black">
            <div id="sl-camera" className="w-full h-full" />
            {loading && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3">
                <div className="relative flex items-center justify-center w-14 h-14">
                  <div className="absolute inset-0 border-4 border-[#10B981]/20 rounded-full animate-ping" />
                  <div className="absolute inset-0 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                  <span className="text-lg">✨</span>
                </div>
                <p className="text-[#10B981] font-semibold text-sm animate-pulse">AI is thinking…</p>
                <p className="text-gray-500 text-xs text-center px-8">
                  Cross-referencing with your health profile
                </p>
              </div>
            )}
            {camErr && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
                <AlertCircle size={32} className="text-gray-500" />
                <p className="text-gray-400 text-sm text-center leading-relaxed">
                  Camera access denied.{"\n"}Allow camera in browser settings and reload.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─ NAFDAC ─ */}
        {mode === "nafdac" && <NAFDACInput />}

        {/* ─ OCR ─ */}
        {mode === "ocr" && (
          <OCRInput
            isAnalyzing={loading}
            onResult={handleOCRResult}
          />
        )}

        {/* ─ History ─ */}
        {mode === "history" && (
          <div className="absolute inset-3 overflow-y-auto">
            <ScanHistory />
          </div>
        )}

        {/* ─ Profiles ─ */}
        {mode === "profiles" && (
          <div className="absolute inset-3 overflow-y-auto">
            <FamilyProfiles
              onProfileChange={(p: FamilyProfile | null) => {
                setActiveProfileState(p);
                setMode("barcode");
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-around px-6 py-3 border-t border-white/5 flex-shrink-0 pb-safe">
        <button
          onClick={() => setMode("history")}
          className={"flex flex-col items-center gap-1 " + (mode === "history" ? "opacity-100" : "opacity-40")}
        >
          <Clock size={20} className={mode === "history" ? "text-[#10B981]" : "text-gray-400"} />
          <span className={"text-[10px] " + (mode === "history" ? "text-[#10B981]" : "text-gray-400")}>History</span>
        </button>

        <button
          onClick={() => { setResult(null); setMode("barcode"); }}
          className="w-14 h-14 rounded-full bg-[#10B981] flex items-center justify-center shadow-lg shadow-[#10B981]/30"
        >
          <Camera size={22} className="text-white" />
        </button>

        <button
          onClick={() => setMode("profiles")}
          className={"flex flex-col items-center gap-1 " + (mode === "profiles" ? "opacity-100" : "opacity-40")}
        >
          <Users size={20} className={mode === "profiles" ? "text-[#10B981]" : "text-gray-400"} />
          <span className={"text-[10px] " + (mode === "profiles" ? "text-[#10B981]" : "text-gray-400")}>Profiles</span>
        </button>
      </div>

      {/* Result sheet */}
      {result && (
        <ResultSheet result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NAFDAC Input
// ─────────────────────────────────────────────────────────────
function NAFDACInput() {
  const [num, setNum]       = useState("");
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState<{
    verified?: boolean; product_name?: string; error?: string;
  } | null>(null);

  async function verify() {
    if (!num.trim()) return;
    setBusy(true); setStatus(null);
    try {
      const api = process.env.NEXT_PUBLIC_NAFDAC_API_URL;
      if (!api) { setStatus({ error: "Set NEXT_PUBLIC_NAFDAC_API_URL in .env.local" }); return; }
      const r = await fetch(`${api}/verify/nafdac/${encodeURIComponent(num.trim())}`);
      setStatus(await r.json());
    } catch { setStatus({ error: "Cannot reach backend. Is Railway deployed?" }); }
    finally   { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
      <p className="text-gray-500 text-sm text-center">
        Enter the NAFDAC registration number printed on the product label
      </p>
      <input
        value={num}
        onChange={e => setNum(e.target.value)}
        onKeyDown={e => e.key === "Enter" && verify()}
        placeholder="e.g. A4-1234"
        className="w-full max-w-xs bg-[#1A2235] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#10B981] transition-colors"
      />
      <button
        onClick={verify}
        disabled={busy || !num.trim()}
        className="bg-[#10B981] text-white px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
      {status && (
        <div className={[
          "w-full max-w-xs p-4 rounded-xl text-sm",
          status.verified
            ? "bg-green-900/30 border border-green-800 text-green-400"
            : "bg-red-900/30  border border-red-800  text-red-400",
        ].join(" ")}>
          {status.verified
            ? `✓ Verified: ${status.product_name}`
            : `✗ ${status.error ?? "Number not found on NAFDAC portal"}`}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OCR Input  (photo + manual entry fallback)
// ─────────────────────────────────────────────────────────────
function OCRInput({
  onResult,
  isAnalyzing,
}: {
  onResult:    (text: string) => void;
  isAnalyzing: boolean;
}) {
  const [pct, setPct]           = useState(0);
  const [busy, setBusy]         = useState(false);
  const [manualMode, setManual] = useState(false);
  const [manualText, setManual2] = useState("");

  // AI analysis screen (shown while backend is processing)
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <div className="relative flex items-center justify-center w-16 h-16 mb-2">
          <div className="absolute inset-0 border-4 border-[#10B981]/20 rounded-full animate-ping" />
          <div className="absolute inset-0 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin" />
          <span className="text-xl">✨</span>
        </div>
        <p className="text-[#10B981] font-semibold text-lg animate-pulse">SafeLens is analyzing…</p>
        <p className="text-gray-500 text-xs text-center">
          Cross-referencing ingredients with your health profile
        </p>
      </div>
    );
  }

  // OCR progress screen
  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-[#10B981] text-sm mb-1 font-medium">Reading label… {pct}%</p>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-56">
          <div
            className="h-full bg-[#10B981] transition-all duration-200 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">Extracting ingredient text from image</p>
      </div>
    );
  }

  // Manual text entry
  if (manualMode) {
    return (
      <div className="flex flex-col h-full gap-4 px-4 pt-4 pb-6">
        <div className="flex justify-between items-center">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Manual Entry</p>
          <button onClick={() => setManual(false)} className="text-gray-500 text-sm">Cancel</button>
        </div>
        <textarea
          className="flex-1 w-full bg-[#1A2235] border border-white/10 rounded-xl p-4 text-sm text-white placeholder-gray-600 outline-none focus:border-[#10B981] resize-none"
          placeholder="Paste or type ingredient list here e.g. Water, Sugar, Malt Extract, Salt…"
          value={manualText}
          onChange={e => setManual2(e.target.value)}
        />
        <button
          onClick={() => { if (manualText.trim()) onResult(manualText); }}
          disabled={!manualText.trim()}
          className="w-full bg-[#10B981] text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          Analyse Ingredients
        </button>
      </div>
    );
  }

  async function scan(file: File) {
    setBusy(true); setPct(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: ({ progress: p }: { progress: number }) => setPct(Math.round(p * 100)),
      });
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      if (text.trim()) onResult(text);
      else alert("Could not read any text from the image. Try a clearer photo or use manual entry.");
    } catch { alert("OCR failed. Run: npm install tesseract.js"); }
    finally   { setBusy(false); }
  }

  // Default: camera + manual options
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
      <p className="text-gray-500 text-sm text-center leading-relaxed">
        Photograph the ingredient label — AI reads and analyses every ingredient
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <label className="bg-[#10B981] text-white w-full text-center py-3 rounded-xl text-sm font-semibold cursor-pointer active:opacity-80">
          Take Photo of Label
          <input
            type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => e.target.files?.[0] && scan(e.target.files[0])}
          />
        </label>
        <button
          onClick={() => setManual(true)}
          className="bg-transparent border border-white/10 text-gray-400 w-full py-3 rounded-xl text-sm font-semibold active:bg-white/5 transition-colors"
        >
          Type Ingredients Manually
        </button>
      </div>
    </div>
  );
}