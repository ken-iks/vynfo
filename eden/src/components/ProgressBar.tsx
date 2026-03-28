export function ProgressBar({ value }: { value: number }) {
  const percent = Math.min(Math.max(value, 0), 100);
  return (
    <div className="w-full rounded-full bg-gray-200 h-2">
      <div
        className="h-2 rounded-full bg-blue-500 transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
