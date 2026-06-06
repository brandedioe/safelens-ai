// src/lib/supabase.ts
// Community database + report submission + profile sync.
// All functions silently no-op if Supabase is not configured.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

// ── Community product database (the Nigerian product moat) ────
// Products submitted by community OCR scans accumulate here.
// Every future user who scans the same barcode benefits.

export async function getCommunityProduct(barcode: string): Promise<{
  name?: string;
  ingredients_text?: string;
} | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("products")
      .select("name, ingredients_text")
      .eq("barcode", barcode)
      .maybeSingle();          // returns null if not found (no error thrown)
    return data;
  } catch { return null; }
}

export async function saveCommunityProduct(
  barcode:         string,
  ingredientsText: string,
  productName?:    string
): Promise<void> {
  if (!supabase) return;
  if (!ingredientsText?.trim() || !barcode?.trim()) return;
  try {
    await supabase.from("products").upsert(
      {
        barcode,
        name:             productName ?? "Community Submission",  // NOT NULL in schema
        ingredients_text: ingredientsText.slice(0, 5000),         // cap length
        source:           "community",
      },
      { onConflict: "barcode" }   // update if already exists
    );
  } catch { /* silent — this is a background enrichment, not critical */ }
}

// ── Fake / unsafe product reports ─────────────────────────────
export async function submitReport(data: {
  product_barcode: string;
  product_name:    string;
  description:     string;
  market_name?:    string;
  city?:           string;
  lat?:            number;
  lng?:            number;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured in .env.local / Vercel env vars.");

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

  if (error) throw new Error(error.message);
}

// ── User health profiles (Supabase sync) ──────────────────────
export async function upsertProfile(profile: {
  id:                 string;
  display_name?:      string;
  allergies?:         string[];
  medications?:       string[];
  health_conditions?: string[];
}): Promise<void> {
  if (!supabase) return;
  await supabase.from("user_profiles").upsert(profile);
}