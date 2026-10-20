/**
 * Only photos from our own Blob store are ever shown, so a profile can't point
 * at some other site's image (which could track who looks at it).
 */
export function isOurPhotoUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
