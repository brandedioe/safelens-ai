import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  // Your existing config options can stay here
};

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Cache all API calls to Open Food Facts for 30 days
      {
        urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "food-api-cache",
          expiration: { maxEntries: 2000, maxAgeSeconds: 86400 * 30 },
        },
      },
    ],
  },
});

export default process.env.NODE_ENV === "production" ? withPWA(nextConfig) : nextConfig;