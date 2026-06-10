import { Skeleton } from "@/components/ui/skeleton";

/** Instant route feedback while server pages load. */
export default function Loading() {
  return (
    <div>
      <div className="border-b border-border px-8 py-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
