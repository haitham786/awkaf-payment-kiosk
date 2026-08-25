import { supabase } from "@/integrations/supabase/client";

const BUCKET = "profile-pictures";

/**
 * Normalizes a stored profile picture value to a bucket-relative path.
 * Supports legacy values that were stored as full public URLs.
 */
export function toStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx !== -1) return value.slice(idx + marker.length).split("?")[0];
  if (value.startsWith("http")) return null;
  return value;
}

/**
 * Resolves a stored profile picture reference into a short-lived signed URL.
 * The bucket is private, so direct public URLs are not available.
 */
export async function resolveProfilePictureUrl(
  value: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string> {
  const path = toStoragePath(value);
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}
