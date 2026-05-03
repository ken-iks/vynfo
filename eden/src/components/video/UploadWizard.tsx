import { ArrowPathIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { client } from "../../lib/client";
import { create } from "@bufbuild/protobuf";
import {
  UploadAudioRequestSchema,
  UploadVideoRequestSchema,
} from "../../gen/proto/v1/projects_pb";
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
  mediaType?: "audio" | "video";
  onUploadCompleted: (assetId: string) => void;
}

export function UploadWizard({
  projectId,
  mediaType = "video",
  onUploadCompleted,
}: UploaderProps) {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasFirstResponse, setHasFirstResponse] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const userId = useAuth();
  const isAudio = mediaType === "audio";
  const uploadLabel = isAudio ? "Upload Audio" : "Upload Video";
  const acceptedMime = isAudio ? "audio/*" : "video/mp4";
  const buttonLabel = isAudio ? "Upload Audio" : "Initiate Upload";

  function resetUploadState() {
    setIsUploading(false);
    setHasFirstResponse(false);
    setUploadPercentage(0);
  }

  async function handleUpload() {
    if (!mediaFile) {
      throw new Error(`upload must have a ${mediaType} set`);
    }
    setIsUploading(true);
    setHasFirstResponse(false);
    setUploadPercentage(0);
    setUploadError(null);
    try {
      if (isAudio) {
        const request = create(UploadAudioRequestSchema, {
          userId: userId,
          projectId: projectId,
          content: new Uint8Array(await mediaFile.arrayBuffer()),
          title: mediaFile.name,
        });
        for await (const response of client.uploadAudio(request)) {
          setHasFirstResponse(true);
          switch (response.uploadStatus.case) {
            case "ongoing":
              setUploadPercentage(
                response.uploadStatus.value.completionPercentage,
              );
              break;
            case "finished":
              onUploadCompleted(response.uploadStatus.value.audioId);
              resetUploadState();
              break;
          }
        }
      } else {
        const request = create(UploadVideoRequestSchema, {
          userId: userId,
          projectId: projectId,
          content: new Uint8Array(await mediaFile.arrayBuffer()),
          title: mediaFile.name,
        });
        for await (const response of client.uploadVideo(request)) {
          setHasFirstResponse(true);
          switch (response.uploadStatus.case) {
            case "ongoing":
              setUploadPercentage(
                response.uploadStatus.value.completionPercentage,
              );
              break;
            case "finished":
              onUploadCompleted(response.uploadStatus.value.videoId);
              resetUploadState();
              break;
          }
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
      {isUploading ? (
        hasFirstResponse ? (
          <div className="flex items-center gap-2">
            <ArrowUpTrayIcon className="size-5 animate-pulse" />
            <ProgressBar value={uploadPercentage} />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <ArrowPathIcon className="size-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Uploading…</span>
          </div>
        )
      ) : (
        <>
          <DragUploadArea
            onFileSelected={setMediaFile}
            selectedFile={mediaFile}
            accept={acceptedMime}
            label={uploadLabel}
            isAcceptedFile={(file) => file.type.startsWith(`${mediaType}/`)}
          />
          {mediaFile !== null && (
            <div className="flex justify-center">
              <Button onClick={handleUpload} disabled={!mediaFile} size="sm">
                {buttonLabel}
              </Button>
            </div>
          )}
        </>
      )}
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
