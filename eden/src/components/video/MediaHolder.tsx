import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyVideoPlayer } from "./EmptyVideoPlayer";
import { UploadWizard } from "./UploadWizard";
import { VideoPlayer } from "./VideoPlayer";

interface MediaHolderProps {
  projectId: string
}

export function MediaHolder({projectId} : MediaHolderProps) {
  const [videoSrc, setVideoSrc] = useState("");

  const handleUploading = (videoId: string) => {
    setVideoSrc(`/video?videoId=${videoId}&mode=live`);
  };
  const handleUploaded = (videoId: string) => {
    setVideoSrc(`/video?videoId=${videoId}&mode=historical`);
  };

  return (
    <Card className="w-1/2 mx-auto">
      <CardContent className="space-y-8">
        <UploadWizard
          projectId={projectId}
          onUploadCompleted={handleUploaded}
          onUploadOngoing={handleUploading}
        />
        {videoSrc !== "" ? (
          <VideoPlayer src={videoSrc} />
        ) : (
          <EmptyVideoPlayer />
        )}
      </CardContent>
    </Card>
  );
}
