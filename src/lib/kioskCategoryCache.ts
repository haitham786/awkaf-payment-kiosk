export interface KioskCategoryCacheItem {
  category_id: string;
  title: string;
  title_en: string | null;
  icon_url: string | null;
  category_reference?: string | null;
  description?: string | null;
  description_en?: string | null;
  info_text?: string | null;
  info_text_en?: string | null;
  display_order?: number;
  is_visible?: boolean | null;
}

export const CATEGORY_CACHE_KEY = "kiosk_home_categories";

const imageCache = new Set<string>();

// Use localStorage for persistence across app restarts (instant load on cold start).
const storage = typeof window !== "undefined" ? window.localStorage : null;

export const readCachedCategory = (categoryId: string | null) => {
  if (!categoryId || !storage) return null;

  const cached = storage.getItem(`category_${categoryId}`);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as KioskCategoryCacheItem;
  } catch {
    return null;
  }
};

export const readCachedCategories = () => {
  if (!storage) return [] as KioskCategoryCacheItem[];
  const cached = storage.getItem(CATEGORY_CACHE_KEY);
  if (!cached) return [] as KioskCategoryCacheItem[];

  try {
    return JSON.parse(cached) as KioskCategoryCacheItem[];
  } catch {
    return [] as KioskCategoryCacheItem[];
  }
};

export const preloadCategoryImages = (items: Array<{ icon_url?: string | null }>) => {
  items.forEach((item) => {
    if (!item.icon_url || imageCache.has(item.icon_url)) return;

    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = item.icon_url;
    imageCache.add(item.icon_url);
  });
};

export const primeCategoryCache = (items: KioskCategoryCacheItem[]) => {
  if (!storage) return;
  storage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(items));

  items.forEach((item) => {
    if (!item.category_id) return;
    storage.setItem(`category_${item.category_id}`, JSON.stringify(item));
  });

  preloadCategoryImages(items);
};

export const storeCategoryInCache = (item: KioskCategoryCacheItem) => {
  if (!storage) return;
  storage.setItem(`category_${item.category_id}`, JSON.stringify(item));
  preloadCategoryImages([item]);
};
