import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
     <div className="space-y-6 p-4 md:p-6"> {/* Consistent padding */}
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
         {Array.from({ length: 3 }).map((_, index) => ( // Agent might see fewer KPI cards or just 2 + motivation
            <Skeleton key={index} className="h-[180px] w-full rounded-lg" />
         ))}
          <Skeleton className="h-[180px] w-full rounded-lg md:col-span-2 lg:col-span-1" /> {/* Motivation card placeholder */}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
       </div>
     </div>
  )
}
