import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { client } from "../../lib/client";
import { create } from "@bufbuild/protobuf";
import { UploadVideoRequestSchema } from "../../gen/proto/v1/api_pb";
import { Button } from "@/components/ui/button";
import { DragUploadArea } from "./DragUploadArea";
import { ProgressBar } from "./ProgressBar";
import { useAuth } from "../providers/AuthProvider";

interface UploaderProps {
  projectId: string;
  onUploadOngoing: (videoId: string) => void;
  onUploadCompleted: (videoId: string) => void;
}

export function UploadWizard({
  projectId,
  onUploadOngoing,
  onUploadCompleted,
}: UploaderProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const userId = useAuth();

  async function handleUpload() {
    if (!videoFile) {
      throw new Error("upload must have a video set");
    }
    setIsUploading(true);
    const request = create(UploadVideoRequestSchema, {
      userId: userId,
      projectId: projectId,
      content: new Uint8Array(await videoFile.arrayBuffer()),
      title: videoFile.name,
    });
    for await (const response of client.uploadVideo(request)) {
      switch (response.uploadStatus.case) {
        case "ongoing":
          onUploadOngoing(response.uploadStatus.value.videoId);
          setUploadPercentage(response.uploadStatus.value.completionPercentage);
          break;
        case "finished":
          onUploadCompleted(response.uploadStatus.value.videoId);
          break;
      }
    }
  }

  return (
    <div>
      <DragUploadArea onFileSelected={setVideoFile} selectedFile={videoFile} />
      {videoFile !== null && (
        <div className="flex justify-center">
          <Button
            onClick={handleUpload}
            disabled={!videoFile || isUploading}
            size="sm"
          >
            Initiate Upload
          </Button>
        </div>
      )}
      {isUploading ? (
        <div className="flex items-center gap-2">
          <ArrowUpTrayIcon className="size-5 animate-pulse" />
          <ProgressBar value={uploadPercentage} />
        </div>
      ) : null}
    </div>
  );
}
