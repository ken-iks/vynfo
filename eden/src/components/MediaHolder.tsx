import clsx from "clsx";
import { useState } from "react";
import { EmptyVideoPlayer } from "./EmptyVideoPlayer";
import { UploadWizard } from "./UploadWizard";
import { VideoPlayer } from "./VideoPlayer";

export function MediaHolder() {
  const [videoSrc, setVideoSrc] = useState("");

  const handleUploading = (videoId: string) => {
    setVideoSrc(`/video?videoId=${videoId}&mode=live`);
  };
  const handleUploaded = (videoId: string) => {
    setVideoSrc(`/video?videoId=${videoId}&mode=historical`);
  };

  return (
    <div
      className={clsx(
        "flex-col w-1/2 mx-auto",
        "border rounded p-5 space-y-8",
      )}
    >
      <UploadWizard
        onUploadCompleted={handleUploaded}
        onUploadOngoing={handleUploading}
      />
      {videoSrc !== "" ? <VideoPlayer src={videoSrc} /> : <EmptyVideoPlayer />}
    </div>
  );
}
