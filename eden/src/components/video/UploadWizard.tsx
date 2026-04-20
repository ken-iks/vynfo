import { ArrowPathIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { client } from "../../lib/client";
import { create } from "@bufbuild/protobuf";
import { UploadVideoRequestSchema } from "../../gen/proto/v1/api_pb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [hasFirstResponse, setHasFirstResponse] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const userId = useAuth();

  function resetUploadState() {
    setIsUploading(false);
    setHasFirstResponse(false);
    setUploadPercentage(0);
  }

  async function handleUpload() {
    if (!videoFile) {
      throw new Error("upload must have a video set");
    }
    setIsUploading(true);
    setHasFirstResponse(false);
    setUploadPercentage(0);
    setUploadError(null);
    const request = create(UploadVideoRequestSchema, {
      userId: userId,
      projectId: projectId,
      content: new Uint8Array(await videoFile.arrayBuffer()),
      title: videoFile.name,
    });
    try {
      for await (const response of client.uploadVideo(request)) {
        setHasFirstResponse(true);
        switch (response.uploadStatus.case) {
          case "ongoing":
            onUploadOngoing(response.uploadStatus.value.videoId);
            setUploadPercentage(
              response.uploadStatus.value.completionPercentage,
            );
            break;
          case "finished":
            onUploadCompleted(response.uploadStatus.value.videoId);
            break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(message);
      resetUploadState();
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
      {isUploading && !hasFirstResponse ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <ArrowPathIcon className="size-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Uploading…</span>
        </div>
      ) : null}
      {isUploading && hasFirstResponse ? (
        <div className="flex items-center gap-2">
          <ArrowUpTrayIcon className="size-5 animate-pulse" />
          <ProgressBar value={uploadPercentage} />
        </div>
      ) : null}
      <Dialog
        open={uploadError !== null}
        onOpenChange={(open) => {
          if (!open) setUploadError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error uploading</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {uploadError}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
