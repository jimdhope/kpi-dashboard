import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { KPI } from '@/services/kpi'; // Import the KPI type

interface KpiCardProps {
  kpi: KPI;
  icon?: React.ReactNode; // Optional icon prop
}

export function KpiCard({ kpi, icon }: KpiCardProps) {
  const progress = (kpi.achievement / kpi.target) * 100;
  const formattedTarget = kpi.target.toLocaleString();
  const formattedAchievement = kpi.achievement.toLocaleString();

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{formattedAchievement}</div>
        <p className="text-xs text-muted-foreground">Target: {formattedTarget}</p>
        <Progress value={progress} className="mt-3 h-2" />
         <CardDescription className="mt-1 text-xs">
          {progress.toFixed(0)}% achieved
        </CardDescription>
      </CardContent>
    </Card>
  );
}
