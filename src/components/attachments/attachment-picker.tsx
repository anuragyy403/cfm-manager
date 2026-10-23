"use client";

import { useEffect, useRef, useState } from "react";
import { put } from "@vercel/blob/client";
import { AlertCircle, FileText, ImagePlus, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  extForType,
  formatBytes,
  IMAGE_MAX_PX,
  MAX_ATTACHMENTS,
  MAX_VIDEO_BYTES,
  MAX_FILE_BYTES,
} from "@/lib/attachments";
import { cn } from "@/lib/utils";
import { discardUploadAction, finishUploadAction, startUploadAction } from "@/server/actions/attachments";

/** Photos already this small are sent as they are. */
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;

/**
 * Shrinks a big photo to at most IMAGE_MAX_PX on its longest side as a JPEG,
 * honouring the camera's rotation. Small photos, and GIFs (which would lose
 * their animation), go up untouched.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, IMAGE_MAX_PX / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= KEEP_AS_IS_BYTES && extForType(file.type)) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  // Transparent screenshots would turn black as JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/jpeg", 0.85),
  );
}

type Item = {
  key: string;
  name: string;
  isVideo: boolean;
  isFile: boolean;
  preview: string;
  status: "uploading" | "ready" | "error";
  progress: number;
  error?: string;
  id?: string;
  abort: AbortController;
};

/**
 * "Add photos or videos": pick, drop or (on a phone) shoot them. Each file
 * uploads straight away with a progress bar; `onChange` reports the uploaded
 * ids and whether anything is still uploading, so the form can wait.
 */
export function AttachmentPicker({
  onChange,
  disabled,
  hint = "Photos or videos, up to 50 MB each.",
  allowFiles = false,
}: {
  onChange: (state: { ids: string[]; busy: boolean }) => void;
  disabled?: boolean;
  hint?: string;
  allowFiles?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
    onChange({
      ids: items.flatMap((i) => (i.status === "ready" && i.id ? [i.id] : [])),
      busy: items.some((i) => i.status === "uploading"),
    });
  }, [items, onChange]);

  // Free the local previews when the form closes.
  useEffect(
    () => () => {
      for (const i of itemsRef.current) {
        i.abort.abort();
        URL.revokeObjectURL(i.preview);
      }
    },
    [],
  );

  function update(key: string, patch: Partial<Item>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function upload(item: Item, file: File) {
    try {
      const body = item.isVideo || item.isFile ? file : await shrinkPhoto(file).catch(() => null);
      if (!body) throw new Error("Couldn't read that photo. Try a JPG or PNG.");
      // iPhone videos (.mov) are stored as MP4, see `extForType`.
      const type = body.type === "video/quicktime" ? "video/mp4" : body.type;
      const start = await startUploadAction({ type, size: body.size });
      if (!start.ok) throw new Error(start.error);
      await put(start.data.pathname, body, {
        access: "private",
        token: start.data.token,
        contentType: start.data.contentType,
        multipart: body.size > 8 * 1024 * 1024,
        abortSignal: item.abort.signal,
        onUploadProgress: ({ percentage }) => update(item.key, { progress: percentage }),
      });
      const done = await finishUploadAction({ pathname: start.data.pathname, name: file.name });
      if (!done.ok) throw new Error(done.error);
      if (item.abort.signal.aborted) {
        void discardUploadAction(done.data.id);
        return;
      }
      update(item.key, { status: "ready", progress: 100, id: done.data.id });
    } catch (e) {
      if (item.abort.signal.aborted) return;
      const message = e instanceof Error && e.message ? e.message : "Upload failed. Check your connection.";
      update(item.key, { status: "error", error: message.startsWith("Vercel Blob") ? "Upload failed. Try again." : message });
    }
  }

  function add(files: FileList | File[]) {
    const room = MAX_ATTACHMENTS - itemsRef.current.length;
    const picked = [...files];
    if (picked.length > room) toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
    const next: [Item, File][] = [];
    for (const file of picked.slice(0, Math.max(0, room))) {
      const isVideo = file.type.startsWith("video/");
      const isFile = !isVideo && !file.type.startsWith("image/");
      if (isFile && (!allowFiles || !extForType(file.type))) {
        toast.error(allowFiles ? `${file.name}: use PDF, DOCX, XLSX, PPTX, TXT, CSV or ZIP.` : `${file.name} isn't a photo or video.`);
        continue;
      }
      if (isFile && file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name}: documents can be up to 25 MB.`);
        continue;
      }
      if (isVideo && !extForType(file.type)) {
        toast.error(`${file.name}: use an MP4, MOV or WebM video.`);
        continue;
      }
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        toast.error(`${file.name} is ${formatBytes(file.size)}. Videos can be up to 50 MB: trim it or record a shorter clip.`);
        continue;
      }
      const item: Item = {
        key: crypto.randomUUID(),
        name: file.name,
        isVideo,
        isFile,
        preview: URL.createObjectURL(file),
        status: "uploading",
        progress: 0,
        abort: new AbortController(),
      };
      next.push([item, file]);
    }
    if (next.length === 0) return;
    setItems((list) => [...list, ...next.map(([i]) => i)]);
    for (const [item, file] of next) void upload(item, file);
  }

  function remove(item: Item) {
    item.abort.abort();
    URL.revokeObjectURL(item.preview);
    setItems((list) => list.filter((i) => i.key !== item.key));
    if (item.id) void discardUploadAction(item.id);
  }

  const full = items.length >= MAX_ATTACHMENTS;

  return (
    <div
      className={cn("space-y-2 rounded-lg transition-colors", dragging && "bg-sun/10 ring-2 ring-sun/60 ring-offset-4 ring-offset-popover")}
      onDragOver={(e) => {
        if (disabled || full || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        setDragging(false);
        if (disabled || full || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        add(e.dataTransfer.files);
      }}
    >
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.key} className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
              {item.isFile ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs">
                  <FileText className="size-6 shrink-0" /><span className="line-clamp-3 break-all">{item.name}</span>
                </div>
              ) : item.isVideo ? (
                <>
                  <video src={`${item.preview}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
                  <span className="pointer-events-none absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white">
                    <Play className="size-3 fill-current" />
                  </span>
                </>
              ) : (
                // A local preview of the picked photo.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt={item.name} className="size-full object-cover" />
              )}
              {item.status === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/45 text-white">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-[11px] font-medium tabular-nums">{Math.round(item.progress)}%</span>
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                    <span className="block h-full bg-sun transition-[width]" style={{ width: `${item.progress}%` }} />
                  </span>
                </div>
              )}
              {item.status === "error" && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/85 p-1.5 text-center text-[11px] leading-tight text-white"
                  title={item.error}
                >
                  <AlertCircle className="size-4" />
                  <span className="line-clamp-3">{item.error}</span>
                </div>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(item)}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                aria-label={`Remove ${item.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled || full}>
          <ImagePlus />
          {items.length ? "Add more" : allowFiles ? "Attach files" : "Add photos or videos"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {full ? `That's the most you can attach (${MAX_ATTACHMENTS}).` : `${hint} Or drop them here.`}
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept={`image/*,video/mp4,video/quicktime,video/webm${allowFiles ? ",application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip" : ""}`}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) add(e.target.files);
          e.target.value = ""; // picking the same file again still triggers a change
        }}
      />
    </div>
  );
}
