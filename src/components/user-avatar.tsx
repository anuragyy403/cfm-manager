import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { isOurPhotoUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

// Soft background + strong text pairs; each person always gets the same one.
const PALETTE = [
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

export function UserAvatar({
  name,
  id,
  size = "sm",
  className,
  image,
}: {
  name: string;
  /** Their profile photo; initials show when there's none (or it fails to load). */
  image?: string | null;
  /** Stable seed for the colour (user id); falls back to the name. */
  id?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {isOurPhotoUrl(image) && <AvatarImage src={image} alt={name} />}
      <AvatarFallback className={cn("font-semibold", colorFor(id ?? name))}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
