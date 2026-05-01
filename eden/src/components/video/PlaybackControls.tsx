import {
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
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
  const videoFrameHandleRef = useRef<number | null>(null);
  const animationFrameHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!video) return;

    const syncPlaybackPosition = () => {
      setCurrentTime(video.currentTime);
      editorStore.setPlaybackTimeSeconds(video.currentTime);
    };

    const sync = () => {
      syncPlaybackPosition();
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setIsPaused(video.paused);
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    const cancelPlaybackLoop = () => {
      if (videoFrameHandleRef.current !== null) {
        video.cancelVideoFrameCallback(videoFrameHandleRef.current);
        videoFrameHandleRef.current = null;
      }
      if (animationFrameHandleRef.current !== null) {
        window.cancelAnimationFrame(animationFrameHandleRef.current);
        animationFrameHandleRef.current = null;
      }
    };

    const scheduleAnimationFrame = () => {
      animationFrameHandleRef.current = window.requestAnimationFrame(() => {
        animationFrameHandleRef.current = null;
        syncPlaybackPosition();
        if (!video.paused && !video.ended) {
          scheduleAnimationFrame();
        }
      });
    };

    const scheduleVideoFrame = () => {
      videoFrameHandleRef.current = video.requestVideoFrameCallback(() => {
        videoFrameHandleRef.current = null;
        syncPlaybackPosition();
        if (!video.paused && !video.ended) {
          scheduleVideoFrame();
        }
      });
    };

    const startPlaybackLoop = () => {
      cancelPlaybackLoop();
      if (video.paused || video.ended) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        scheduleVideoFrame();
        return;
      }
      scheduleAnimationFrame();
    };

    const syncAndStartPlaybackLoop = () => {
      sync();
      startPlaybackLoop();
    };

    const syncAndCancelPlaybackLoop = () => {
      cancelPlaybackLoop();
      sync();
    };

    sync();
    video.addEventListener("durationchange", sync);
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("pause", syncAndCancelPlaybackLoop);
    video.addEventListener("play", syncAndStartPlaybackLoop);
    video.addEventListener("ended", syncAndCancelPlaybackLoop);
    video.addEventListener("seeking", sync);
    video.addEventListener("seeked", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("volumechange", sync);
    startPlaybackLoop();

    return () => {
      cancelPlaybackLoop();
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("pause", syncAndCancelPlaybackLoop);
      video.removeEventListener("play", syncAndStartPlaybackLoop);
      video.removeEventListener("ended", syncAndCancelPlaybackLoop);
      video.removeEventListener("seeking", sync);
      video.removeEventListener("seeked", sync);
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
    <div className="flex items-center gap-2 text-xs">
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
      <div className="flex-1" />
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
