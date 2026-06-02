"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

export default function BarcodeScanner({ onScan }: { onScan: (result: string) => void }) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "safelens-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          showTorchButtonIfSupported: true,
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScan(decodedText);
          scannerRef.current?.pause(true); 
        },
        (error) => {} // Suppress noisy frame-drop errors
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="w-full h-full relative z-10">
      <style dangerouslySetInnerHTML={{__html: `
        #safelens-reader { border: none !important; }
        #safelens-reader img { display: none !important; }
        #safelens-reader__scan_region { background: #0B0E1C; }
        #safelens-reader__dashboard_section_csr button { 
          background: #10B981 !important; color: white !important; 
          border: none !important; padding: 8px 16px !important; 
          border-radius: 8px !important; margin-top: 10px;
        }
      `}} />
      <div id="safelens-reader" className="w-full h-full overflow-hidden rounded-xl" />
    </div>
  );
}