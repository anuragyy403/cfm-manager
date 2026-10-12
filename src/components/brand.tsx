import Image from "next/image";
import { cn } from "@/lib/utils";

export const APP_NAME = "CFM Workplace";
export const COMPANY_NAME = "Clickfieldmedia";

/** The Clickfieldmedia round logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt={`${COMPANY_NAME} logo`}
      width={64}
      height={64}
      priority
      className={cn("size-8 shrink-0 rounded-full ring-1 ring-black/5", className)}
    />
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  );
}
