"use client";

/** A short confetti burst in brand colours. Skipped for reduced-motion users. */
export async function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#e65e15", "#0c243e", "#f59a5c", "#ffffff"];
  const base = { particleCount: 70, spread: 70, startVelocity: 45, ticks: 180, colors, zIndex: 9999 };
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.75 } });
}
