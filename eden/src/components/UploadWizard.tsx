import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { client } from "../lib/client";
import { create } from "@bufbuild/protobuf";
import { UploadVideoRequestSchema } from "../gen/proto/v1/api_pb";
import { DragUploadArea } from "./DragUploadArea";
import { ProgressBar } from "./ProgressBar";

interface UploaderProps {
  onUploadOngoing: (videoId: string) => void;
  onUploadCompleted: (videoId: string) => void;
}

const projectId = "27a485b2-3466-4e1c-a36f-f0e8ce9f0378";
const userId = "d322efef-cb5f-4cb8-9dc7-92e5500265fe";

export function UploadWizard({
  onUploadOngoing,
  onUploadCompleted,
}: UploaderProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);

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
          <button
            onClick={handleUpload}
            disabled={!videoFile || isUploading}
            className="btn btn-primary btn-sm border p-1"
          >
            Initate Upload
          </button>
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
