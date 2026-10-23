import { findViewableAttachment, readStoredFile, signedFileUrl } from "@/server/attachments";
import { getCurrentUser } from "@/server/session";

/**
 * Opens an attachment for someone allowed to see it.
 * - Viewing: a redirect to a short-lived signed link to the private store.
 *   The storage CDN then serves it, including the range requests phones need
 *   to play and seek videos.
 * - `?download=1`: the file itself, saved under its original name.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to see this file.", { status: 401 });
  const { id } = await params;
  const file = await findViewableAttachment(user, id);
  if (!file) return new Response("File not found.", { status: 404 });

  if (new URL(request.url).searchParams.has("download") || (!file.contentType.startsWith("image/") && !file.contentType.startsWith("video/"))) {
    const stored = await readStoredFile(file.pathname);
    if (!stored?.stream) return new Response("File not found.", { status: 404 });
    return new Response(stored.stream, {
      headers: {
        "content-type": file.contentType,
        "content-length": String(stored.blob.size),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: await signedFileUrl(file.pathname),
      // Shorter than the link's life, so a cached redirect never points at an expired link.
      "cache-control": "private, max-age=1800",
      "referrer-policy": "no-referrer",
    },
  });
}
