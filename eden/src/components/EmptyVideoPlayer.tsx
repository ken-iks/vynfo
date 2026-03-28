import { VideoCameraSlashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export function EmptyVideoPlayer() {
  return (
    <div
      className={clsx(
        "w-full aspect-video rounded-lg",
        "bg-neutral-100 dark:bg-neutral-800",
        "flex flex-col items-center justify-center gap-2",
        "text-neutral-400",
      )}
    >
      <VideoCameraSlashIcon className="size-8" />
      <span className="text-sm">No video loaded</span>
    </div>
  );
}
