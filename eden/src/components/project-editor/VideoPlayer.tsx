import Hls from "hls.js";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type VideoPlayerProps = {
  src: string;
  onReadyToPlay?: () => void;
};

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayer({ src, onReadyToPlay }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useImperativeHandle(ref, () => videoRef.current!, []);
    // Track currentTime in a ref so we can restore playback position across src
    // changes. hls.destroy() resets the video element before the next effect
    // runs, so reading video.currentTime inline would always yield 0.
    const savedTimeRef = useRef(0);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onTimeUpdate = () => {
        savedTimeRef.current = video.currentTime;
      };
      video.addEventListener("timeupdate", onTimeUpdate);

      return () => video.removeEventListener("timeupdate", onTimeUpdate);
    }, []);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !onReadyToPlay) return;

      if (video.readyState >= video.HAVE_FUTURE_DATA) {
        onReadyToPlay();
        return;
      }

      video.addEventListener("canplay", onReadyToPlay, { once: true });

      return () => video.removeEventListener("canplay", onReadyToPlay);
    }, [onReadyToPlay, src]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const restoreTime = savedTimeRef.current;

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (restoreTime > 0) {
            video.currentTime = restoreTime;
          }
          video.play();
        });

        return () => hls.destroy();
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      }
    }, [src]);

    return (
      <video ref={videoRef} controls className="block aspect-video w-full" />
    );
  },
);

type AudioPlayerProps = {
  src: string;
};

export const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(
  function AudioPlayer({ src }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    useImperativeHandle(ref, () => audioRef.current!, []);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(audio);

        return () => hls.destroy();
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = src;
      }
    }, [src]);

    return <audio ref={audioRef} className="hidden" />;
  },
);
