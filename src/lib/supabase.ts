// src/lib/supabase.ts
// Supabase is optional — app works without it (community features disabled).
// Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && key ? createClient(url, key) : null;

// ── Community report ─────────────────────────────────────────
export async function submitReport(data: {
  product_barcode: string;
  product_name:    string;
  description:     string;
  market_name?:    string;
  city?:           string;
  lat?:            number;
  lng?:            number;
}) {
  if (!supabase) return { error: "Supabase not configured in .env.local" };

  const { error } = await supabase.from("community_reports").insert({
    product_barcode: data.product_barcode,
    product_name:    data.product_name,
    description:     data.description,
    market_name:     data.market_name ?? "",
    city:            data.city ?? "Lagos",
    status:          "pending",
    ...(data.lat != null && data.lng != null
      ? { location: `POINT(${data.lng} ${data.lat})` }
      : {}),
  });

  return { error };
}

// ── User profile (Supabase) ──────────────────────────────────
export async function upsertProfile(profile: {
  id:                string;
  display_name?:     string;
  allergies?:        string[];
  medications?:      string[];
  health_conditions?: string[];
}) {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.from("user_profiles").upsert(profile);
  return { error };
}

// ── Community Products Moat (Phase 3) ────────────────────────

// 1. Check if another user has already scanned this product
export async function getCommunityProduct(barcode: string) {
  if (!supabase) return null; // Safe fallback if not configured
  
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
      .single();
      
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// 2. Silently save a successful OCR scan so the next user doesn't have to scan it
export async function saveCommunityProduct(barcode: string, ingredientsText: string) {
  if (!supabase) return; // Safe fallback if not configured
  
  try {
    await supabase.from("products").upsert({
      barcode: barcode,
      name: "Community Scanned Product",
      ingredients_text: ingredientsText,
      source: "ocr_scan"
    }, { onConflict: "barcode" });
  } catch (error) {
    console.error("Failed to sync to community database", error);
  }
}