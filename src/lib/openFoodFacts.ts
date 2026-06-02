// src/lib/openFoodFacts.ts

export interface ProductData {
  name: string;
  brand: string;
  ingredients: string;
  found: boolean;
}

export async function fetchByBarcode(barcode: string): Promise<ProductData | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,ingredients_text`
    );
    const data = await res.json();

    // The API returns status: 1 if the product is found
    if (data.status !== 1) {
      return { found: false, name: "", brand: "", ingredients: "" };
    }

    return {
      found: true,
      name: data.product.product_name || "Unknown Product",
      brand: data.product.brands || "",
      ingredients: data.product.ingredients_text || "",
    };
  } catch (error) {
    console.error("Open Food Facts fetch error:", error);
    return null;
  }
}