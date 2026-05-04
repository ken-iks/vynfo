import { VideoCameraSlashIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export function EmptyVideoPlayer() {
  return (
    <div
      className={cn(
        "w-full aspect-video rounded-lg",
        "bg-muted",
        "flex flex-col items-center justify-center gap-2",
        "text-muted-foreground",
      )}
    >
      <VideoCameraSlashIcon className="size-8" />
      <span className="text-sm">No video loaded</span>
    </div>
  );
}
