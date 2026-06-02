"use client";

import React from "react";
import { AlertTriangle, XCircle, ShieldAlert } from "lucide-react";
import { ScanResult } from "@/data/ingredients";

interface ResultCardProps {
  barcode: string;
  productName: string;
  analysis: ScanResult | null;
  isAnalyzing: boolean;
  onReset: () => void;
}

export default function ResultCard({ barcode, productName, analysis, isAnalyzing, onReset }: ResultCardProps) {
  
  // Determine color based on the AI's final score
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-[#10B981] shadow-[#10B981]/20 text-white"; // Green
    if (score >= 50) return "bg-[#F59E0B] shadow-[#F59E0B]/20 text-white"; // Yellow
    return "bg-[#EF4444] shadow-[#EF4444]/20 text-white"; // Red
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-full duration-300 ease-out pb-4 sm:pb-0">
      <div className="bg-[#0D1220] border-t border-white/[0.08] sm:border sm:rounded-b-[28px] rounded-t-3xl p-5 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] min-h-[300px] flex flex-col">
        
        {/* Drag Handle & Close Button */}
        <div className="flex justify-center mb-4 relative shrink-0">
          <div className="w-12 h-1.5 bg-[#1C2336] rounded-full" />
          <button onClick={onReset} className="absolute right-0 top-0 text-[#8B9CC8] hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Loading State */}
        {isAnalyzing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-[#10B981]/20 border-t-[#10B981] rounded-full animate-spin" />
            <p className="text-sm font-mono text-[#8B9CC8] animate-pulse">Running AI Analysis...</p>
          </div>
        )}

        {/* Product Not Found State */}
        {!isAnalyzing && !analysis && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <ShieldAlert className="w-12 h-12 text-[#F59E0B] mb-2" />
            <h2 className="text-lg font-bold text-white">Product Not Found</h2>
            <p className="text-xs text-[#8B9CC8] px-4">
              Barcode #{barcode} isn't in the database yet. Try scanning the ingredient text using the OCR mode instead.
            </p>
          </div>
        )}

        {/* Successful Analysis State */}
        {!isAnalyzing && analysis && (
          <>
            <div className="flex gap-4 items-center mb-4 shrink-0">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${getScoreColor(analysis.score)}`}>
                <span className="text-xl font-bold font-mono">{analysis.score}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-[#EEF2FF] truncate">{productName}</h2>
                <p className="text-[10px] text-[#4D5E80] font-mono mt-0.5">BARCODE: {barcode}</p>
              </div>
            </div>

            <div className="bg-[#1C2336] border border-white/[0.04] rounded-xl p-3 mb-4 shrink-0">
              <p className="text-xs leading-relaxed text-[#8B9CC8] font-medium">
                {analysis.findings.length === 0 
                  ? "No dangerous additives detected in our database. Looks safe!" 
                  : `Detected ${analysis.findings.length} flagged ingredients.`}
              </p>
            </div>

            {/* Scrollable Findings List */}
            {analysis.findings.length > 0 && (
              <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1 mb-2">
                {analysis.findings.map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs shrink-0 ${
                    item.type === 'danger' ? 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]' :
                    item.type === 'caution' ? 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]' :
                    'bg-[#4F90F0]/10 border-[#4F90F0]/20 text-[#4F90F0]'
                  }`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">{item.name}</span>
                      <span className="opacity-80 text-[10px] leading-tight block">{item.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}