export function PageHeader({
  title,
  description,
  meta,
  children,
}: {
  title: string;
  description?: string;
  /** Small line shown directly beneath the title (e.g. a date range). */
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    // 88px matches the sidebar logo block, so titles center with the logo.
    <div className="flex min-h-[88px] items-center justify-between gap-6 border-b border-border px-8 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {meta ? (
          <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
        ) : null}
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
