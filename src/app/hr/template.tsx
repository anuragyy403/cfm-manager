/** Re-mounts on every navigation, giving each page a gentle entrance. */
export default function HRTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
      {children}
    </div>
  );
}
