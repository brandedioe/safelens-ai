"use client";

import React, { useState } from "react";
import { Camera, Barcode, ShieldCheck, FileText, Settings, History } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import ResultCard from "@/components/ResultCard";

// NEW IMPORTS FOR THE AI PIPELINE
import { fetchByBarcode } from "@/lib/openFoodFacts";
import { analyzeIngredients, ScanResult } from "@/data/ingredients";

export default function SafeLensDashboard() {
  const [activeMode, setActiveMode] = useState<"barcode" | "nafdac" | "ocr">("barcode");
  const [scanResult, setScanResult] = useState<string | null>(null);
  
  // NEW: AI Pipeline States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ productName: string, result: ScanResult | null } | null>(null);

  // NAFDAC specific state
  const [isVerifying, setIsVerifying] = useState(false);
  const [nafdacInput, setNafdacInput] = useState("");

  // UPDATED: Triggers the full AI scanning pipeline
  
  const handleSuccessfulScan = async (result: string) => {
    // 1. Show the card and lock the camera into a loading state
    setScanResult(result);
    setIsAnalyzing(true);
    
    try {
      // 2. Fetch the raw ingredients from the internet
      const product = await fetchByBarcode(result);
      
      if (product && product.found) {
        // 3. Feed the ingredients to your local AI rule engine!
        const analysis = analyzeIngredients(product.ingredients);
        setAnalysisData({ productName: product.name, result: analysis });
      } else {
        // Barcode not in Open Food Facts database
        setAnalysisData({ productName: "", result: null });
      }
    } catch (error) {
      console.error(error);
      setAnalysisData({ productName: "", result: null });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setScanResult(null); // Closes the card and reactivates the scanner
    setNafdacInput("");  // Clear the input when resetting
    setAnalysisData(null); // Clear previous AI results
  };

  // NAFDAC API call to your Python backend
  const handleNafdacVerification = async () => {
    if (!nafdacInput) return;
    setIsVerifying(true);
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/verify/nafdac/${nafdacInput}`);
      const data = await res.json();
      
      console.log("NAFDAC Response:", data);
      
      // We pass a dummy result here just to trigger the Result Card to slide up 
      // so you can visually confirm the API call finished!
      setScanResult(data.nafdac_number || nafdacInput);
      
    } catch (error) {
      console.error("Backend offline", error);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090F] text-[#EEF2FF] flex items-center justify-center p-0 sm:p-4 font-sans">
      <div className="w-full h-screen sm:h-[840px] sm:w-[400px] sm:rounded-[36px] sm:border-8 sm:border-[#232C42] bg-[#0D1220] flex flex-col justify-between overflow-hidden shadow-2xl relative">
        
        <header className="bg-[#0B0E1C] px-6 py-4 border-b border-white/[0.06] flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <h1 className="text-xs font-bold tracking-[0.2em] font-mono text-[#EEF2FF]">
              SAFELENS AI
            </h1>
          </div>
          <div className="flex gap-3 text-[#8B9CC8]">
            <History className="w-4 h-4 cursor-pointer hover:text-[#10B981]" />
            <Settings className="w-4 h-4 cursor-pointer hover:text-[#10B981]" />
          </div>
        </header>

        <section className="bg-[#0B0E1C] px-4 py-3 flex justify-between gap-1 border-b border-white/[0.04] z-20">
          <button onClick={() => setActiveMode("barcode")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${activeMode === "barcode" ? "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20" : "bg-[#131928] text-[#8B9CC8]"}`}><Barcode className="w-3.5 h-3.5" /> Barcode</button>
          <button onClick={() => setActiveMode("nafdac")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${activeMode === "nafdac" ? "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20" : "bg-[#131928] text-[#8B9CC8]"}`}><ShieldCheck className="w-3.5 h-3.5" /> NAFDAC#</button>
          <button onClick={() => setActiveMode("ocr")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${activeMode === "ocr" ? "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20" : "bg-[#131928] text-[#8B9CC8]"}`}><FileText className="w-3.5 h-3.5" /> OCR Text</button>
        </section>

        <div className="flex-1 bg-[#07090F] p-4 flex flex-col justify-between relative z-10">
          <div className="w-full h-full rounded-2xl border-2 border-dashed border-[#10B981]/40 bg-[#131928]/40 flex flex-col items-center justify-center relative overflow-hidden">
            
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[#10B981] z-20" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[#10B981] z-20" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[#10B981] z-20" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[#10B981] z-20" />

            {/* 1. Live Camera Feed */}
            {!scanResult && activeMode === "barcode" && (
              <BarcodeScanner onScan={handleSuccessfulScan} />
            )}
            
            {/* 2. NAFDAC Manual Input UI */}
            {!scanResult && activeMode === "nafdac" && (
              <div className="flex flex-col items-center gap-4 w-full max-w-[280px] px-4 z-20">
                <div className="w-full bg-[#0B0E1C] border border-white/[0.08] rounded-xl p-2 flex items-center gap-2 shadow-inner">
                  <ShieldCheck className="w-5 h-5 text-[#8B9CC8] ml-2" />
                  <input 
                    type="text" 
                    placeholder="Enter NAFDAC Reg." 
                    value={nafdacInput}
                    onChange={(e) => setNafdacInput(e.target.value)}
                    className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-[#4D5E80] uppercase"
                  />
                </div>
                
                <button 
                  onClick={handleNafdacVerification}
                  disabled={isVerifying}
                  className="w-full bg-[#10B981] hover:bg-[#059669] text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#10B981]/20 transition-all disabled:opacity-50"
                >
                  {isVerifying ? "Contacting Portal..." : "Verify Registry"}
                </button>
              </div>
            )}

            {/* 3. OCR Placeholder */}
            {!scanResult && activeMode === "ocr" && (
              <div className="flex flex-col items-center gap-3 max-w-[240px] text-center px-4 z-20">
                <div className="p-4 rounded-full bg-[#1C2336] text-[#10B981] mb-2 shadow-inner"><Camera className="w-6 h-6 animate-pulse" /></div>
                <p className="text-sm font-medium text-[#EEF2FF]">Text Extraction</p>
              </div>
            )}

          </div>
        </div>

        <footer className="bg-[#0B0E1C] p-6 border-t border-white/[0.06] flex flex-col items-center justify-center gap-4 z-20">
          <button 
            onClick={() => handleSuccessfulScan("5449000000996")} 
            className="w-16 h-16 rounded-full bg-[#10B981] hover:bg-[#059669] text-white flex items-center justify-center shadow-lg shadow-[#10B981]/20 active:scale-95 transition-all outline-none ring-4 ring-[#10B981]/10"
          >
            <Camera className="w-7 h-7" />
          </button>
          <div className="text-[10px] uppercase tracking-widest text-[#4D5E80] font-mono">
            Offline Engine Active
          </div>
        </footer>

        {/* Slide up the updated dynamic result card over everything if we have a scan! */}
        {scanResult && (
          <ResultCard 
            barcode={scanResult} 
            productName={analysisData?.productName || ""}
            analysis={analysisData?.result || null}
            isAnalyzing={isAnalyzing}
            onReset={handleReset} 
          />
        )}

      </div>
    </main>
  );
}