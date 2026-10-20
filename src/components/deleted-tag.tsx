import { cn } from "@/lib/utils";

/** Marks someone whose account the owner deleted. Their record is kept. */
export function DeletedTag({ className }: { className?: string }) {
  return (
    <span
      title="This account was deleted. Their tasks and history are kept."
      className={cn(
        "ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-px align-middle text-[10px] font-medium whitespace-nowrap text-red-700 dark:bg-red-950 dark:text-red-300",
        className,
      )}
    >
      Deleted
    </span>
  );
}
