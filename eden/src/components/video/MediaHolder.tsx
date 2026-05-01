import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "../providers/AuthProvider";
import { EmptyVideoPlayer } from "./EmptyVideoPlayer";
import { UploadWizard } from "./UploadWizard";
import { VideoPlayer } from "./VideoPlayer";

interface MediaHolderProps {
  projectId: string;
  onUploadCompleted: () => void;
}

export function MediaHolder({
  projectId,
  onUploadCompleted,
}: MediaHolderProps) {
  const [videoSrc, setVideoSrc] = useState("");
  const userId = useAuth();

  const handleUploading = (videoId: string) => {
    setVideoSrc(`/video?videoId=${videoId}&userId=${userId}`);
  };
  const handleUploaded = (videoId: string) => {
    setVideoSrc(`/video?videoId=${videoId}&userId=${userId}`);
    onUploadCompleted();
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
