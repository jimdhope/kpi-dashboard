import { Skeleton } from "@/components/ui/skeleton";
// No DashboardLayout needed here, applied by layout.tsx

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
     <div className="space-y-6 p-4 md:p-6"> {/* Add padding matching main content */}
        {/* Simulate KPI cards loading */}
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
         {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[180px] w-full rounded-lg" />
         ))}
        </div>
        {/* Simulate Leaderboards loading */}
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
       </div>
     </div>
  )
}
