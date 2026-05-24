// Prefetches kiosk visual assets (background, logo, category icons) and stores
// them in the browser's Cache Storage so that on every subsequent cold start
// the images render instantly from local cache — no network round-trip.
//
// Strategy:
// 1. Read cached URLs from localStorage and warm Cache Storage immediately
//    (no waiting for Supabase).
// 2. In parallel, ask Supabase for the latest URLs, persist them to
//    localStorage, and prime Cache Storage so the very next boot is instant.
//
// This module is intentionally side-effect only and safe to call during app
// bootstrap (main.tsx) — failures are swallowed.

import { supabase } from "@/integrations/supabase/client";
import {
  primeCategoryCache,
  readCachedCategories,
  preloadCategoryImages,
  type KioskCategoryCacheItem,
} from "@/lib/kioskCategoryCache";

const CACHE_NAME = "kiosk-assets-v1";

const warmCache = async (urls: string[]) => {
  if (!("caches" in window) || urls.length === 0) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      urls.map(async (url) => {
        try {
          const hit = await cache.match(url);
          if (hit) return;
          // `no-cors` lets us cache cross-origin Supabase storage URLs as opaque
          // responses; the WebView will still paint them correctly via <img>.
          const res = await fetch(url, { mode: "no-cors", cache: "force-cache" });
          await cache.put(url, res);
        } catch {
          /* ignore individual failures */
        }
      })
    );
  } catch {
    /* ignore */
  }
};

const preloadViaImageTag = (urls: string[]) => {
  urls.forEach((url) => {
    if (!url) return;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  });
};

export const prefetchKioskAssets = () => {
  if (typeof window === "undefined") return;

  // (1) Warm immediately from whatever we already know about (instant boot).
  const cachedBg = localStorage.getItem("kiosk_background_url") || "";
  const cachedLogo = localStorage.getItem("kiosk_logo_url") || "";
  const cachedCategories = readCachedCategories();
  const cachedIcons = cachedCategories.map((c) => c.icon_url || "").filter(Boolean);

  const immediateUrls = [cachedBg, cachedLogo, ...cachedIcons].filter(Boolean);
  preloadViaImageTag(immediateUrls);
  void warmCache(immediateUrls);

  // (2) Refresh from backend in the background and re-prime caches.
  (async () => {
    try {
      const [settingsRes, categoriesRes] = await Promise.all([
        supabase
          .from("kiosk_settings")
          .select("background_image_url, logo_url, quranic_verse, quranic_verse_surah")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("donation_categories")
          .select("*")
          .eq("is_visible", true)
          .order("display_order", { ascending: true }),
      ]);

      const bg = settingsRes.data?.background_image_url || "";
      const logo = settingsRes.data?.logo_url || "";
      if (bg) localStorage.setItem("kiosk_background_url", bg);
      if (logo) localStorage.setItem("kiosk_logo_url", logo);
      if (settingsRes.data) {
        localStorage.setItem(
          "kiosk_home_settings",
          JSON.stringify({
            quranic_verse: settingsRes.data.quranic_verse || "",
            quranic_verse_surah: (settingsRes.data as any).quranic_verse_surah || "",
          })
        );
      }

      const categories = (categoriesRes.data || []) as KioskCategoryCacheItem[];
      if (categories.length) {
        primeCategoryCache(categories);
        preloadCategoryImages(categories);
      }

      const freshUrls = [
        bg,
        logo,
        ...categories.map((c) => c.icon_url || ""),
      ].filter(Boolean);
      preloadViaImageTag(freshUrls);
      void warmCache(freshUrls);
    } catch {
      /* ignore — UI still works from cache */
    }
  })();
};
