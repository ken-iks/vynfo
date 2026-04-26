import {
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/utils";
import { editorStore } from "../stores/editor";

export function PlaybackControls({
  video,
}: {
  video: HTMLVideoElement | null;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!video) return;

    const sync = () => {
      setCurrentTime(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setIsPaused(video.paused);
      setIsMuted(video.muted);
      setVolume(video.volume);
      editorStore.setPlaybackTimeSeconds(video.currentTime);
    };

    sync();
    video.addEventListener("durationchange", sync);
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("play", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("volumechange", sync);

    return () => {
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("play", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("volumechange", sync);
    };
  }, [video]);

  const togglePlayback = () => {
    if (!video) return;

    if (video.paused) {
      void video.play();
      return;
    }

    video.pause();
  };

  const seek = (value: number[]) => {
    if (!video) return;

    const nextTime = value[0] ?? 0;
    if (Number.isFinite(nextTime)) {
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
      editorStore.setPlaybackTimeSeconds(nextTime);
    }
  };

  const toggleMuted = () => {
    if (!video) return;

    video.muted = !video.muted;
  };

  const changeVolume = (value: number[]) => {
    if (!video) return;

    const nextVolume = value[0] ?? 0;
    if (Number.isFinite(nextVolume)) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
    }
  };

  return (
    <div className="flex items-center gap-2 border bg-background/95 p-2 text-xs">
      <Button
        aria-label={isPaused ? "Play" : "Pause"}
        disabled={!video}
        onClick={togglePlayback}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {isPaused ? <PlayIcon /> : <PauseIcon />}
      </Button>
      <span className="w-24 tabular-nums">
        {formatDuration(currentTime * 1000)} / {formatDuration(duration * 1000)}
      </span>
      <Slider
        aria-label="Playback position"
        className="flex-1"
        disabled={!video || duration === 0}
        max={duration || 0}
        min={0}
        onValueChange={seek}
        step={0.01}
        value={[Math.min(currentTime, duration || currentTime)]}
      />
      <Button
        aria-label={isMuted ? "Unmute" : "Mute"}
        disabled={!video}
        onClick={toggleMuted}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {isMuted || volume === 0 ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
      </Button>
      <Slider
        aria-label="Volume"
        className="w-20"
        disabled={!video}
        max={1}
        min={0}
        onValueChange={changeVolume}
        step={0.01}
        value={[isMuted ? 0 : volume]}
      />
    </div>
  );
}
