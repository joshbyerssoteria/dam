import Link from "next/link";
import { Palette } from "lucide-react";
import { QuickShareButton } from "@/components/quick-share-button";

export function KitCard({
  kit,
  canShare,
}: {
  kit: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    cover_image_id: string | null;
  };
  canShare: boolean;
}) {
  return (
    <div className="group overflow-hidden border border-border bg-card transition-colors hover:border-muted-foreground/40">
      <Link href={`/kits/${kit.slug}`} className="block" draggable={false}>
        <div className="flex aspect-[2/1] items-center justify-center bg-asset">
          {kit.cover_image_id ? (
            /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
            <img
              src={`/api/files/${kit.cover_image_id}?w=960`}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          ) : (
            <Palette className="size-8 text-muted-foreground" strokeWidth={1.25} />
          )}
        </div>
      </Link>
      {/* Footer is a flex row so the share button centers vertically in the
          strip below the thumbnail, whatever the description wraps to. */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Link
          href={`/kits/${kit.slug}`}
          className="min-w-0 flex-1"
          draggable={false}
        >
          <h2 className="text-sm font-medium">{kit.name}</h2>
          {kit.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {kit.description}
            </p>
          ) : null}
        </Link>
        {canShare ? (
          <div className="shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <QuickShareButton targetType="kit" targetId={kit.id} size="icon" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
