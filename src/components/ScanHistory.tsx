"use client";
import { useState, useEffect } from "react";
import { Clock, Trash2, AlertTriangle, Pill, ShieldOff } from "lucide-react";
import { getScanHistory, clearScanHistory } from "@/lib/storage";

const GRADE_COLOR: Record<string, string> = {
  A: "#10B981", B: "#34D399", C: "#FBBF24", D: "#F97316", F: "#EF4444",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60)    + "m ago";
  if (s < 86400) return Math.floor(s / 3600)  + "h ago";
  return           Math.floor(s / 86400) + "d ago";
}

// ── Inline summary panel (shown when a history item is tapped)
function ScanSummary({
  item,
  onClose,
}: {
  item: any;
  onClose: () => void;
}) {
  const r     = item?.result ?? {};
  const score = r.score ?? 0;
  const grade = r.grade ?? "?";
  const color = GRADE_COLOR[grade] ?? "#6B7280";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-h-[60vh] bg-[#F8FAFC] rounded-t-2xl overflow-y-auto"
        style={{ animation: "slideUp 0.2s ease-out" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="px-4 pb-6 pt-2">
          {/* Score + name */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
              style={{ background: color }}
            >
              {score}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {r.productName ?? "Unknown product"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: color + "22", color }}
                >
                  Grade {grade}
                </span>
                <span className="text-xs text-gray-400">{timeAgo(item.scannedAt)}</span>
              </div>
            </div>
          </div>

          {/* Allergy alerts */}
          {(r.allergyAlerts ?? []).length > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Allergy alerts
              </p>
              {r.allergyAlerts.map((a: string) => (
                <p key={a} className="text-xs text-red-600">• {a}</p>
              ))}
            </div>
          )}

          {/* Drug interaction alerts */}
          {(r.drugAlerts ?? []).length > 0 && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-xs font-bold text-orange-700 mb-1 flex items-center gap-1">
                <Pill size={12} /> Drug interaction alerts
              </p>
              {r.drugAlerts.map((d: any, i: number) => (
                <p key={i} className="text-xs text-orange-600">
                  • {d.drug} ({d.severity} risk)
                </p>
              ))}
            </div>
          )}

          {/* Re-scan tip */}
          <p className="text-xs text-gray-400 text-center mt-2">
            To see the full AI analysis again, scan the product barcode or label once more.
          </p>
        </div>
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

// ── Main ScanHistory component ─────────────────────────────────
export default function ScanHistory() {
  const [scans,        setScans]   = useState<any[]>([]);
  const [loading,      setLoading] = useState(true);
  const [confirmClear, setConfirm] = useState(false);
  const [selected,     setSelected] = useState<any | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const history = await getScanHistory(60);
    setScans(history);
    setLoading(false);
  }

  async function handleClear() {
    await clearScanHistory();
    setScans([]);
    setConfirm(false);
  }

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div>
          <p className="text-white font-semibold text-sm">Scan History</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {scans.length === 0
              ? "No scans yet"
              : scans.length + " product" + (scans.length !== 1 ? "s" : "") + " scanned"}
          </p>
        </div>
        {scans.length > 0 && (
          confirmClear ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="text-xs text-gray-400 px-3 py-1.5 rounded-lg bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="text-xs text-red-400 px-3 py-1.5 rounded-lg bg-red-900/30"
              >
                Clear all
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 px-3 py-1.5 rounded-lg bg-white/5"
            >
              <Trash2 size={12} /> Clear
            </button>
          )
        )}
      </div>

      {/* Empty state */}
      {scans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
          <Clock size={36} className="text-gray-700" />
          <p className="text-gray-500 text-sm leading-relaxed">
            Scan a product barcode or photograph an ingredient label — results appear here automatically.
          </p>
        </div>
      )}

      {/* Scan list */}
      <div className="flex flex-col gap-2">
        {scans.map(item => {
          const r            = item.result ?? {};
          const score        = r.score ?? 0;
          const grade        = r.grade ?? "?";
          const name         = r.productName ?? "Unknown product";
          const brand        = r.brand ?? "";
          const hasAllergy   = (r.allergyAlerts  ?? []).length > 0;
          const hasDrug      = (r.drugAlerts      ?? []).length > 0;
          const isOCR        = String(item.id ?? "").startsWith("ocr-");
          const col          = GRADE_COLOR[grade] ?? "#6B7280";

          return (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="w-full text-left bg-[#1A2235] border border-white/7 rounded-2xl p-3.5 flex items-center gap-3 active:opacity-75 transition-opacity"
            >
              {/* Score circle */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{
                  background: col + "22",
                  border:     "1.5px solid " + col,
                  color:      col,
                }}
              >
                {score}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium truncate flex-1">{name}</p>
                  {isOCR && (
                    <span className="text-[9px] bg-[#1A2235] text-gray-500 border border-white/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      OCR
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {brand && (
                    <span className="text-gray-500 text-xs truncate max-w-[90px]">{brand}</span>
                  )}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: col + "22", color: col }}
                  >
                    {grade}
                  </span>
                  {hasAllergy && (
                    <span className="text-[10px] font-semibold text-red-400 flex items-center gap-0.5">
                      <AlertTriangle size={9} /> Allergy
                    </span>
                  )}
                  {hasDrug && (
                    <span className="text-[10px] font-semibold text-orange-400 flex items-center gap-0.5">
                      <Pill size={9} /> Drug
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-[10px] mt-0.5">{timeAgo(item.scannedAt)}</p>
              </div>

              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Summary panel */}
      {selected && (
        <ScanSummary item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}