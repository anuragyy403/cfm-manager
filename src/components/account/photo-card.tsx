"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { removePhotoAction, setMyPhotoAction } from "@/server/actions/account";

/** Photos are stored this many pixels square: sharp on phones, ~30 KB. */
const PHOTO_PX = 384;

/**
 * Center-crops a picked photo to a square and shrinks it to a small JPEG in
 * the browser, so big phone photos upload in a blink. Honours the camera's
 * rotation.
 */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(PHOTO_PX, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/jpeg", 0.85),
  );
}

export function PhotoCard({ user }: { user: { id: string; name: string; image: string | null } }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again still triggers a change
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That isn't a photo. Choose a JPG, PNG or WebP image.");
      return;
    }
    startTransition(async () => {
      let photo: Blob;
      try {
        photo = await toSquareJpeg(file);
      } catch {
        toast.error("Couldn't read that photo. Try a JPG or PNG.");
        return;
      }
      const local = URL.createObjectURL(photo);
      setPreview(local);
      const form = new FormData();
      form.append("photo", photo, "photo.jpg");
      const res = await setMyPhotoAction(form);
      if (!res.ok) {
        setPreview(null);
        toast.error(res.error);
        return;
      }
      toast.success("Profile photo updated", { description: "Everyone sees it next to your name." });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removePhotoAction(user.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview(null);
      toast.success("Profile photo removed");
      router.refresh();
    });
  }

  const hasPhoto = !!(preview || user.image);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange-soft text-sun-deep">
          <Camera className="size-[18px]" />
        </span>
        <div className="grid gap-1">
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>Shown next to your name everywhere in CFM Workplace.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          {preview ? (
            // The just-picked photo, shown while it uploads.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={user.name} className="size-20 rounded-full object-cover" />
          ) : (
            <UserAvatar name={user.name} id={user.id} image={user.image} size="lg" className="size-20 text-2xl" />
          )}
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
              <Loader2 className="size-5 animate-spin" />
            </span>
          )}
        </div>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="brand" onClick={() => input.current?.click()} disabled={pending}>
              <Camera />
              {hasPhoto ? "Change photo" : "Upload photo"}
            </Button>
            {hasPhoto && (
              <Button type="button" variant="outline" onClick={remove} disabled={pending}>
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A clear photo of your face works best. It&apos;s cropped to a square automatically.
          </p>
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </CardContent>
    </Card>
  );
}
