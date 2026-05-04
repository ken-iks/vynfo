import { Progress } from "@/components/ui/progress";

export function ProgressBar({ value }: { value: number }) {
  return <Progress value={Math.min(Math.max(value, 0), 100)} />;
}
