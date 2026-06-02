// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Example function: submit a community report
export async function submitReport(report: {
  product_barcode: string;
  product_name: string;
  description: string;
  market_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}) {
  const location = report.latitude
    ? `POINT(${report.longitude} ${report.latitude})`
    : null;

  const { error } = await supabase.from("community_reports").insert({
    ...report,
    location,
    status: "pending",
  });

  if (error) throw error;
}