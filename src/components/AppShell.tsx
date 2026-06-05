"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Users, Clock, Camera, AlertCircle } from "lucide-react";
import ResultSheet  from "./ResultSheet";
import { getCommunityProduct, saveCommunityProduct } from "@/lib/supabase";
import FamilyProfiles from "./FamilyProfiles";
import ScanHistory  from "./ScanHistory";
import { checkDrugInteractions } from "@/lib/drugInteractions";
import { fetchByBarcode }        from "@/lib/openFoodFacts";
import {
  cacheProduct, getCachedProduct, saveScan,
  getActiveProfile,
  type FamilyProfile,
} from "@/lib/storage";

type Mode = "barcode" | "nafdac" | "ocr" | "history" | "profiles";

export default function AppShell() {
  const [mode, setMode]               = useState<Mode>("barcode");
  const [result, setResult]           = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [camErr, setCamErr]           = useState(false);
  const [activeProfile, setActiveProfileState] = useState<FamilyProfile | null>(null);
  const scannerRef = useRef<any>(null);

  // ── Load active profile on mount ────────────────────────────
  useEffect(() => {
    getActiveProfile().then(p => setActiveProfileState(p));
  }, []);

  // ── Camera ───────────────────────────────────────────────────
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

  // ── Barcode handler (Phase 2: adds drug interaction check) ──
  const handleBarcode = useCallback(async (barcode: string) => {
    setLoading(true);
    try {
      // 1. Local cache
      let cached  = await getCachedProduct(barcode);
      let product = cached?.data ?? null;

      // 2. Fetch if needed (Check Supabase FIRST, then Open Food Facts)
      if (!product) {
        const communityMatch = await getCommunityProduct(barcode);
        
        if (communityMatch && communityMatch.ingredients_text) {
          // Found in our own database!
          product = { name: communityMatch.name, brand: "Community", ingredients: communityMatch.ingredients_text };
        } else {
          // Fallback to global database
          const fetched = await fetchByBarcode(barcode);
          if (fetched?.found) {
            await cacheProduct(barcode, fetched);
            product = fetched;
          }
        }
      }
      
      const ingredients = product?.ingredients ?? "";

      // 3. Phase 3 AI — live LLM analysis
      const profileForAnalysis = activeProfile
        ? { allergies: activeProfile.allergies, conditions: activeProfile.conditions, aboutMe: activeProfile.aboutMe }
        : undefined;
        
      const aiResponse = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ text: ingredients, profile: profileForAnalysis }),
      });
      const analysis = await aiResponse.json();

      // 4. Phase 2 — drug interaction check against active profile medications
      const drugAlerts = checkDrugInteractions(
        activeProfile?.medications ?? [],
        ingredients
      );

      // 5. Save to history (compact record)
      const historyRecord = {
        score:         analysis.score,
        grade:         analysis.grade,
        productName:   product?.name  ?? "Unknown product",
        brand:         product?.brand ?? "",
        allergyAlerts: analysis.allergyAlerts,
        drugAlerts:    drugAlerts.map((d: any) => ({ drug: d.drug, severity: d.severity })),
      };
      await saveScan(barcode, historyRecord);

      // 6. Set full result for ResultSheet
      setResult({ barcode, product, analysis, drugAlerts, ts: Date.now() });
    } catch (e) {
      console.error("Scan error:", e);
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  const profileInitials = activeProfile
    ? activeProfile.name.slice(0, 2).toUpperCase()
    : null;

  return (
    <div className="app-height flex flex-col bg-[#07090F] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <Zap size={18} className="text-[#F59E0B]" />

        <span className="text-[11px] font-bold tracking-[3px] text-white">SAFELENS</span>

        {/* Profile avatar — tap to open profiles */}
        <button
          onClick={() => setMode("profiles")}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: profileInitials ? "rgba(16,185,129,0.2)" : "#1A2235",
            border:     profileInitials ? "1.5px solid #10B981"  : "none",
          }}
          title={activeProfile?.name ?? "Profiles"}
        >
          {profileInitials ? (
            <span className="text-[10px] font-bold text-[#10B981]">{profileInitials}</span>
          ) : (
            <Users size={14} className="text-gray-600" />
          )}
        </button>
      </div>

      {/* ── Active profile banner ── */}
      {activeProfile && mode === "barcode" && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-[#10B981] font-semibold flex-1">
            Scanning for {activeProfile.name}
            {activeProfile.allergies.length > 0 && " · " + activeProfile.allergies.length + " allergen" + (activeProfile.allergies.length !== 1 ? "s" : "") + " watched"}
            {activeProfile.medications.length > 0 && " · " + activeProfile.medications.length + " med" + (activeProfile.medications.length !== 1 ? "s" : "") + " checked"}
          </span>
        </div>
      )}

      {/* ── Mode chips (scanner modes only) ── */}
      {(mode === "barcode" || mode === "nafdac" || mode === "ocr") && (
        <div className="flex gap-2 px-4 pb-3 flex-shrink-0">
          {(["barcode", "nafdac", "ocr"] as Mode[]).map((m) => (
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

      {/* ── Content area ── */}
      <div className="flex-1 relative overflow-hidden px-3">

        {/* Barcode camera */}
        {mode === "barcode" && (
          <div className="absolute inset-3 rounded-xl overflow-hidden bg-black">
            <div id="sl-camera" className="w-full h-full" />
            {loading && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white text-sm font-medium">Analysing product…</p>
                </div>
              </div>
            )}
            {camErr && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
                <AlertCircle size={32} className="text-gray-500" />
                <p className="text-gray-400 text-sm text-center">
                  Camera access denied. Allow camera in browser settings and reload.
                </p>
              </div>
            )}
          </div>
        )}

        {/* NAFDAC */}
        {mode === "nafdac" && <NAFDACInput />}

        {/* OCR */}
        {mode === "ocr" && (
          <OCRInput
            isAnalyzing={loading}
            onResult={async (text) => {
              setLoading(true);
              try {
                const profileForAnalysis = activeProfile
                  ? { allergies: activeProfile.allergies, conditions: activeProfile.conditions, aboutMe: activeProfile.aboutMe }
                  : undefined;
                  
                const aiResponse = await fetch("/api/analyze", {
                  method: "POST",
                  body: JSON.stringify({ text, profile: profileForAnalysis }),
                });
                const analysis = await aiResponse.json();

                // ADD THIS CRITICAL CHECK:
                if (!aiResponse.ok || analysis.error) {
                  alert("Backend Error: " + (analysis.error || "Status " + aiResponse.status));
                  setLoading(false);
                  return;
                }
                
                // --- NEW ADDITION: The Community Moat Sync ---
                // Silently back up the raw text to your database so the next user doesn't have to wait for OCR
                await saveCommunityProduct(`manual-ocr-${Date.now()}`, text);
                // ---------------------------------------------
                
                const drugAlerts = checkDrugInteractions(activeProfile?.medications ?? [], text);
                
                setResult({
                  barcode: "ocr-scan",
                  product: { name: "Label Scan", brand: "OCR", ingredients: text },
                  analysis, drugAlerts, ts: Date.now(),
                });
              } catch (e) {
                console.error("AI OCR Error:", e);
              } finally {
                setLoading(false);
              }
            }}
          />
        )}

        {/* Scan history */}
        {mode === "history" && (
          <div className="absolute inset-3 overflow-y-auto pt-1">
            <ScanHistory />
          </div>
        )}

        {/* Family profiles */}
        {mode === "profiles" && (
          <div className="absolute inset-3 overflow-y-auto pt-1">
            <FamilyProfiles
              onProfileChange={(p: any) => {
                setActiveProfileState(p);
                setMode("barcode");
              }}
            />
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <div className="flex items-center justify-around px-6 py-3 border-t border-white/5 flex-shrink-0 pb-safe">
        <button
          onClick={() => setMode("history")}
          className={"flex flex-col items-center gap-1 transition-opacity " + (mode === "history" ? "opacity-100" : "opacity-40")}
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
          className={"flex flex-col items-center gap-1 transition-opacity " + (mode === "profiles" ? "opacity-100" : "opacity-40")}
        >
          <Users size={20} className={mode === "profiles" ? "text-[#10B981]" : "text-gray-400"} />
          <span className={"text-[10px] " + (mode === "profiles" ? "text-[#10B981]" : "text-gray-400")}>Profiles</span>
        </button>
      </div>

      {/* ── Result sheet ── */}
      {result && (
        <ResultSheet result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}

// ─── NAFDAC Input ────────────────────────────────────────────
function NAFDACInput() {
  const [num, setNum]       = useState("");
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState<{ verified?: boolean; product_name?: string; error?: string } | null>(null);

  async function verify() {
    if (!num.trim()) return;
    setBusy(true); setStatus(null);
    try {
      const api = process.env.NEXT_PUBLIC_NAFDAC_API_URL;
      if (!api) { setStatus({ error: "Set NEXT_PUBLIC_NAFDAC_API_URL in .env.local" }); return; }
      const r = await fetch(api + "/verify/nafdac/" + encodeURIComponent(num.trim()));
      setStatus(await r.json());
    } catch { setStatus({ error: "Cannot reach backend." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
      <p className="text-gray-500 text-sm text-center">Enter the NAFDAC registration number printed on the label</p>
      <input value={num} onChange={e => setNum(e.target.value)} onKeyDown={e => e.key === "Enter" && verify()}
        placeholder="e.g. A4-1234"
        className="w-full max-w-xs bg-[#1A2235] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#10B981]" />
      <button onClick={verify} disabled={busy || !num.trim()}
        className="bg-[#10B981] text-white px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-40">
        {busy ? "Verifying…" : "Verify"}
      </button>
      {status && (
        <div className={"w-full max-w-xs p-4 rounded-xl text-sm " + (status.verified ? "bg-green-900/30 border border-green-800 text-green-400" : "bg-red-900/30 border border-red-800 text-red-400")}>
          {status.verified ? "✓ Verified: " + status.product_name : "✗ " + (status.error ?? "Not found")}
        </div>
      )}
    </div>
  );
}

// ─── OCR Input ───────────────────────────────────────────────
function OCRInput({ onResult, isAnalyzing }: { onResult: (text: string) => void, isAnalyzing?: boolean }) {
  const [pct, setPct]   = useState(0);
  const [busy, setBusy] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");

  // 1. The new AI Thinking Screen! 
  // If the backend is fetching, block the screen with this beautiful loader.
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <div className="relative flex items-center justify-center w-16 h-16 mb-2">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 border-4 border-[#10B981]/20 rounded-full animate-ping" />
          {/* Inner spinning ring */}
          <div className="absolute inset-0 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin" />
          {/* Center icon */}
          <span className="text-xl">✨</span>
        </div>
        <p className="text-[#10B981] font-semibold text-lg animate-pulse">AI is thinking...</p>
        <p className="text-gray-500 text-xs text-center">
          Cross-referencing ingredients with your health profile
        </p>
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
    } catch { alert("OCR failed. Run: npm install tesseract.js"); }
    finally { setBusy(false); }
  }

  if (manualMode) {
    return (
      <div className="flex flex-col h-full gap-4 px-4 pt-4 pb-6">
        <div className="flex justify-between items-center">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Manual Entry</p>
          <button onClick={() => setManualMode(false)} className="text-gray-500 text-sm hover:text-white">
            Cancel
          </button>
        </div>
        <textarea
          className="flex-1 w-full bg-[#1A2235] border border-white/10 rounded-xl p-4 text-sm text-white placeholder-gray-600 outline-none focus:border-[#10B981] resize-none"
          placeholder="e.g. Malt extract, Sugar, Skim Milk Powder..."
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <button
          onClick={() => { if (manualText.trim()) onResult(manualText); }}
          disabled={!manualText.trim()}
          className="w-full bg-[#10B981] text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          Analyze Ingredients
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
      <p className="text-gray-500 text-sm text-center leading-relaxed">
        Photograph the ingredient label — AI reads and analyses every ingredient
      </p>
      {busy ? (
        <div className="text-center w-56">
          <p className="text-[#10B981] text-sm mb-3 font-medium">Reading label… {pct}%</p>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-[#10B981] transition-all duration-200 rounded-full" style={{ width: pct + "%" }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <label className="bg-[#10B981] text-white w-full text-center py-3 rounded-xl text-sm font-semibold cursor-pointer active:opacity-80">
            Take Photo of Label
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => e.target.files?.[0] && scan(e.target.files[0])} />
          </label>
          <button
            onClick={() => setManualMode(true)}
            className="bg-transparent border border-white/10 text-gray-400 w-full py-3 rounded-xl text-sm font-semibold active:bg-white/5 transition-colors"
          >
            Type Manually Instead
          </button>
        </div>
      )}
    </div>
  );
}