import { msToPx } from "./timelineGeometry";

interface TimelineRulerProps {
  totalDurationMillis: bigint;
  pxPerSecond: number;
  height?: number;
}

export function TimelineRuler({
  totalDurationMillis,
  pxPerSecond,
  height = 20,
}: TimelineRulerProps) {
  const totalMs = Number(totalDurationMillis);
  const totalPx = msToPx(totalDurationMillis, pxPerSecond);

  const majorStepSec =
    pxPerSecond >= 200 ? 1 : pxPerSecond >= 80 ? 2 : pxPerSecond >= 40 ? 5 : 10;
  const minorStepMs = 500;

  const minors: number[] = [];
  const majors: { ms: number; label: string }[] = [];
  for (let ms = 0; ms <= totalMs; ms += minorStepMs) {
    minors.push(ms);
  }
  for (let s = 0; s * 1000 <= totalMs; s += majorStepSec) {
    majors.push({ ms: s * 1000, label: formatRulerLabel(s) });
  }

  return (
    <div
      className="relative border-b border-border bg-muted/30"
      style={{ width: totalPx, height }}
    >
      {minors.map((ms) => {
        const isMajor = ms % (majorStepSec * 1000) === 0;
        return (
          <div
            key={ms}
            className={isMajor ? "bg-foreground/60" : "bg-foreground/20"}
            style={{
              position: "absolute",
              left: msToPx(BigInt(ms), pxPerSecond),
              bottom: 0,
              width: 1,
              height: isMajor ? height * 0.6 : height * 0.3,
            }}
          />
        );
      })}
      {majors.map(({ ms, label }) => (
        <span
          key={ms}
          className="absolute text-[10px] text-muted-foreground tabular-nums"
          style={{
            left: msToPx(BigInt(ms), pxPerSecond) + 3,
            top: 1,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function formatRulerLabel(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
