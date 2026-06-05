"use client";
import { useState, useEffect } from "react";
import { Clock, Trash2, ChevronRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { getScanHistory, clearScanHistory } from "@/lib/storage";

const GRADE_COLOR: Record<string, string> = {
  A: "#10B981", B: "#34D399", C: "#FBBF24", D: "#F97316", F: "#EF4444",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

interface Props {
  onSelectResult?: (result: any) => void;
}

export default function ScanHistory({ onSelectResult }: Props) {
  const [scans, setScans]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [confirmClear, setConfirm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const history = await getScanHistory(50);
    setScans(history);
    setLoading(false);
  }

  async function handleClear() {
    await clearScanHistory();
    setScans([]);
    setConfirm(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div>
          <p className="text-white font-semibold text-sm">Scan History</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {scans.length === 0 ? "No scans yet" : scans.length + " product" + (scans.length !== 1 ? "s" : "") + " scanned"}
          </p>
        </div>
        {scans.length > 0 && (
          confirmClear ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="text-xs text-gray-400 px-3 py-1.5 rounded-lg bg-white/5">Cancel</button>
              <button onClick={handleClear}              className="text-xs text-red-400 px-3 py-1.5 rounded-lg bg-red-900/30">Clear all</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="flex items-center gap-1.5 text-xs text-gray-500 px-3 py-1.5 rounded-lg bg-white/5">
              <Trash2 size={12} /> Clear
            </button>
          )
        )}
      </div>

      {/* Empty state */}
      {scans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Clock size={36} className="text-gray-700" />
          <p className="text-gray-500 text-sm text-center">
            Scan a product barcode or label to see results here
          </p>
        </div>
      )}

      {/* Scan list */}
      <div className="flex flex-col gap-2">
        {scans.map((item) => {
          const r      = item.result ?? {};
          const score  = r.score ?? 0;
          const grade  = r.grade ?? "?";
          const name   = r.productName ?? "Unknown product";
          const brand  = r.brand       ?? "";
          const hasAllergen = (r.allergyAlerts?.length ?? 0) > 0;
          const hasDrug     = (r.drugAlerts?.length ?? 0) > 0;
          const col    = GRADE_COLOR[grade] ?? "#6B7280";

          return (
            <button
              key={item.id}
              onClick={() => onSelectResult?.(item)}
              className="w-full text-left bg-[#1A2235] border border-white/7 rounded-2xl p-3.5 flex items-center gap-3 active:opacity-80 transition-opacity"
            >
              {/* Score circle */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ background: col + "33", border: "1.5px solid " + col, color: col }}
              >
                {score}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {brand && (
                    <span className="text-gray-500 text-xs truncate">{brand}</span>
                  )}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: col + "22", color: col }}
                  >
                    Grade {grade}
                  </span>
                  {hasAllergen && (
                    <span className="text-[10px] font-semibold text-red-400 flex items-center gap-0.5">
                      <AlertTriangle size={9} />Allergy
                    </span>
                  )}
                  {hasDrug && (
                    <span className="text-[10px] font-semibold text-orange-400 flex items-center gap-0.5">
                      <ShieldCheck size={9} />Drug
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-[10px] mt-0.5">{timeAgo(item.scannedAt)}</p>
              </div>

              <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}