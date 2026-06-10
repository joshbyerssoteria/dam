import Link from "next/link";
import { Folder } from "lucide-react";

export function FolderCard({
  id,
  name,
  photoCount,
  subfolderCount,
}: {
  id: string;
  name: string;
  photoCount: number;
  subfolderCount: number;
}) {
  const parts: string[] = [];
  if (subfolderCount > 0) {
    parts.push(`${subfolderCount} folder${subfolderCount === 1 ? "" : "s"}`);
  }
  parts.push(`${photoCount} photo${photoCount === 1 ? "" : "s"}`);

  return (
    <Link
      href={`/photos/${id}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
    >
      <Folder
        className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        strokeWidth={1.5}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>
      </div>
    </Link>
  );
}
