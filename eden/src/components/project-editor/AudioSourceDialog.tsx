import { useEffect, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/utils/timestamp-conversaions";
import { editorStore, sourceDurationMs } from "../stores/editor";

export interface AudioSourceSection {
  readonly startTimeMillis: bigint;
  readonly endTimeMillis: bigint;
  readonly audio?: {
    readonly audioStartTimeMillies: bigint;
    readonly meta?: {
      readonly duration?: number;
    };
  };
}

interface AudioSourceDialogProps {
  open: boolean;
  section: AudioSourceSection | undefined;
  sectionIndex: number | null;
  onOpenChange: (open: boolean) => void;
}

function formatSecondsValue(ms: bigint) {
  return (Number(ms) / 1000).toFixed(1);
}

function parseSecondsValue(value: string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return BigInt(Math.floor(seconds * 1000));
}

export function AudioSourceDialog({
  open,
  section,
  sectionIndex,
  onOpenChange,
}: AudioSourceDialogProps) {
  const [audioStartMillis, setAudioStartMillis] = useState(0n);
  const [inputValue, setInputValue] = useState("0.0");

  const clipDuration =
    section === undefined ? 0n : section.endTimeMillis - section.startTimeMillis;
  const sourceMs = sourceDurationMs(section?.audio?.meta?.duration);
  const maxAudioStart =
    sourceMs > clipDuration ? sourceMs - clipDuration : 0n;
  const sourceEndMillis = audioStartMillis + clipDuration;
  const canAdjust =
    section !== undefined &&
    section.audio !== undefined &&
    clipDuration > 0n &&
    sourceMs > clipDuration;

  useEffect(() => {
    const nextAudioStart = section?.audio?.audioStartTimeMillies ?? 0n;
    setAudioStartMillis(nextAudioStart);
    setInputValue(formatSecondsValue(nextAudioStart));
  }, [section]);

  const updateAudioStart = (nextAudioStart: bigint) => {
    let clamped = nextAudioStart;
    if (clamped < 0n) {
      clamped = 0n;
    }
    if (clamped > maxAudioStart) {
      clamped = maxAudioStart;
    }
    setAudioStartMillis(clamped);
    setInputValue(formatSecondsValue(clamped));
    if (sectionIndex !== null) {
      editorStore.slipAudioSource(sectionIndex, clamped);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setInputValue(value);
    const parsedValue = parseSecondsValue(value);
    if (parsedValue === null) return;
    updateAudioStart(parsedValue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust audio source</DialogTitle>
          <DialogDescription>
            Move the selected window inside the source audio while keeping the
            clip length and timeline position fixed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Source window</Label>
            <div className="text-xs text-muted-foreground">
              {formatDuration(Number(audioStartMillis))} -{" "}
              {formatDuration(Number(sourceEndMillis))} of{" "}
              {formatDuration(Number(sourceMs))}
            </div>
          </div>
          <Slider
            value={[Number(audioStartMillis)]}
            min={0}
            max={Number(maxAudioStart)}
            step={1}
            disabled={!canAdjust}
            onValueChange={(value) => {
              const [nextValue] = value;
              if (nextValue === undefined) return;
              updateAudioStart(BigInt(nextValue));
            }}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="audio-source-start">Start time, seconds</Label>
            <Input
              id="audio-source-start"
              inputMode="decimal"
              value={inputValue}
              disabled={!canAdjust}
              onChange={handleInputChange}
            />
          </div>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
