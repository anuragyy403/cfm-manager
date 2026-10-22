"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type AttachmentView, formatBytes } from "@/lib/attachments";
import { cn } from "@/lib/utils";

function fileUrl(id: string, download = false) {
  return `/api/files/${id}${download ? "?download=1" : ""}`;
}

/**
 * Attached photos and videos as a row of thumbnails. Tapping one opens it
 * full size, with arrows (or ← →) to move between them and a download button.
 */
export function AttachmentGallery({
  attachments,
  size = "md",
  className,
}: {
  attachments: AttachmentView[];
  /** "sm" for the compact strip under a history entry. */
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : attachments[open];
  const many = attachments.length > 1;

  useEffect(() => {
    if (open === null || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % attachments.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + attachments.length) % attachments.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, many, attachments.length]);

  if (attachments.length === 0) return null;

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)}>
        {attachments.map((a, i) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className={cn(
                "group relative block overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 transition hover:ring-2 hover:ring-sun focus-visible:ring-2 focus-visible:ring-sun focus-visible:outline-none",
                size === "sm" ? "size-14" : "size-24 sm:size-28",
              )}
              aria-label={`Open ${a.kind === "VIDEO" ? "video" : "photo"} ${a.name}`}
            >
              {a.kind === "VIDEO" ? (
                <>
                  <video src={`${fileUrl(a.id)}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <span className={cn("flex items-center justify-center rounded-full bg-black/60 text-white", size === "sm" ? "size-6" : "size-9")}>
                      <Play className={cn("fill-current", size === "sm" ? "size-3" : "size-4")} />
                    </span>
                  </span>
                </>
              ) : (
                // Served from our own route (permission-checked), not through next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(a.id)} alt={a.name} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
              )}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        {current && (
          <DialogContent className="gap-3 bg-[#111] p-3 text-white ring-white/10 sm:max-w-4xl [&>[data-slot=dialog-close]]:text-white [&>[data-slot=dialog-close]]:hover:bg-white/10">
            <div className="pr-10">
              <DialogTitle className="truncate text-sm font-medium text-white">{current.name}</DialogTitle>
              <DialogDescription className="text-xs text-white/60">
                {current.kind === "VIDEO" ? "Video" : "Photo"} · {formatBytes(current.size)}
                {many && ` · ${open! + 1} of ${attachments.length}`}
              </DialogDescription>
            </div>
            <div className="relative flex min-h-48 items-center justify-center">
              {current.kind === "VIDEO" ? (
                <video key={current.id} src={fileUrl(current.id)} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-md bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={current.id} src={fileUrl(current.id)} alt={current.name} className="max-h-[70vh] max-w-full rounded-md object-contain" />
              )}
              {many && (
                <>
                  <NavButton side="left" onClick={() => setOpen((open! - 1 + attachments.length) % attachments.length)} />
                  <NavButton side="right" onClick={() => setOpen((open! + 1) % attachments.length)} />
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-white/60">
                {current.kind === "VIDEO" ? "Won't play here? Download it and open it on your device." : ""}
              </p>
              <Button asChild size="sm" variant="secondary">
                <a href={fileUrl(current.id, true)} download={current.name}>
                  <Download />
                  Download
                </a>
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        side === "left" ? "left-2" : "right-2",
      )}
      aria-label={side === "left" ? "Previous" : "Next"}
    >
      <Icon className="size-5" />
    </button>
  );
}
