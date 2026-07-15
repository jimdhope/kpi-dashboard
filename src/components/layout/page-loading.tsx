import { Skeleton } from "@/components/ui/skeleton";

interface PageLoadingProps {
  cards?: number;
  titleWidth?: string;
}

export function PageLoading({ cards = 3, titleWidth = "w-56" }: PageLoadingProps) {
  return (
    <div className="space-y-6 py-4" role="status" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className={`h-8 ${titleWidth} max-w-full`} />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
