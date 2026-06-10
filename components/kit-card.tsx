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
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-muted-foreground/40">
      <Link href={`/kits/${kit.slug}`} className="block">
        <div className="flex aspect-[2/1] items-center justify-center bg-muted">
          {kit.cover_image_id ? (
            /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
            <img
              src={`/api/files/${kit.cover_image_id}?w=960`}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Palette className="size-8 text-muted-foreground" strokeWidth={1.25} />
          )}
        </div>
        <div className="px-5 py-4 pr-14">
          <h2 className="text-sm font-medium">{kit.name}</h2>
          {kit.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {kit.description}
            </p>
          ) : null}
        </div>
      </Link>
      {canShare ? (
        <div className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <QuickShareButton targetType="kit" targetId={kit.id} size="icon" />
        </div>
      ) : null}
    </div>
  );
}
