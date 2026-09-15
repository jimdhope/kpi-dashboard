import { DialMeterGuide } from "@/components/DialMeterGuide";

export default function DialMeterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dial Meter Reading Guide</h1>
        <p className="text-muted-foreground">Interactive guide to reading dial electricity meters.</p>
      </div>
      <DialMeterGuide />
    </div>
  );
}
