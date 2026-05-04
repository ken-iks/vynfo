import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";

export function formatDuration(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}

export function formatTimestampDate(timestamp: Timestamp): string {
  return timestampDate(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTimestampTime(timestamp: Timestamp): string {
  return timestampDate(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
