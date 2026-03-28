import Hls from "hls.js";
import { useEffect, useRef } from "react";

export function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    <div className="p-3">
      <video ref={videoRef} controls />
    </div>
  );
}
