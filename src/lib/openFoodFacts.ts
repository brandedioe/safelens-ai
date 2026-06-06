// src/lib/openFoodFacts.ts
// Fetches product data by barcode.
// Uses the Railway backend proxy when NEXT_PUBLIC_NAFDAC_API_URL is set
// AND points to a non-localhost address. Falls back to Open Food Facts directly.

const rawBackend = process.env.NEXT_PUBLIC_NAFDAC_API_URL ?? "";

// Never use localhost/127.0.0.1 as the backend in production —
// Vercel serverless functions cannot reach your local machine.
const BACKEND =
  rawBackend &&
  !rawBackend.includes("127.0.0.1") &&
  !rawBackend.includes("localhost")
    ? rawBackend
    : null;

export interface ProductData {
  found:       boolean;
  name:        string;
  brand:       string;
  ingredients: string;
  allergens:   string[];
  imageUrl?:   string;
}

const EMPTY: ProductData = {
  found: false, name: "", brand: "", ingredients: "", allergens: [],
};

export async function fetchByBarcode(barcode: string): Promise<ProductData> {
  try {
    const url = BACKEND
      ? `${BACKEND}/product/barcode/${barcode}`
      : `https://world.openfoodfacts.org/api/v2/product/${barcode}` +
        `?fields=product_name,brands,ingredients_text,allergens_tags,image_url`;

    const res  = await fetch(url, { signal: AbortSignal.timeout(12000) });

    if (!res.ok) return EMPTY;

    const data = await res.json();

    if (!data || data.status !== 1) return EMPTY;

    return {
      found:       true,
      name:        data.product?.product_name    ?? "Unknown product",
      brand:       data.product?.brands          ?? "",
      ingredients: data.product?.ingredients_text ?? "",
      allergens:   (data.product?.allergens_tags ?? []).map(
        (t: string) => t.replace("en:", "")
      ),
      imageUrl: data.product?.image_url,
    };
  } catch {
    return EMPTY;
  }
}