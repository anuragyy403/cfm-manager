export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl dark:text-white">
          {title}
        </h1>
        <span className="block h-1 w-12 rounded-full bg-gradient-to-r from-brand-orange to-[#f59a5c]" aria-hidden />
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
