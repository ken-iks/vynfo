import { ArrowPathIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useState, type SubmitEventHandler } from "react";
import { filesClient } from "../../lib/client";
import { create } from "@bufbuild/protobuf";
import {
  InitiateAudioIngestRequestSchema,
  InitiateVideoIngestRequestSchema,
} from "../../gen/proto/v1/vfs_pb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DragUploadArea } from "./DragUploadArea";
import { ProgressBar } from "./ProgressBar";
import { UploadForm, type UploadTag } from "./UploadForm";
import { useSignedAssetUpload } from "./useSignedAssetUpload";
import type { UploadTarget } from "../vfs/VfsUploadDialog";

interface UploaderProps {
  workspaceId: string;
  parentDirectoryId?: string;
  mediaType?: "audio" | "video";
  target: UploadTarget;
  onUploadCompleted: (assetId: string) => void;
}

export function UploadWizard({
  workspaceId,
  parentDirectoryId,
  mediaType,
  target,
  onUploadCompleted,
}: UploaderProps) {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState("");
  const [tags, setTags] = useState<UploadTag[]>([{ key: "", value: "" }]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [hasFirstResponse, setHasFirstResponse] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isAudio = mediaType === "audio";
  const uploadLabel = isAudio ? "Upload Audio" : "Upload Video";
  const acceptedMime = isAudio ? "audio/mp3" : "video/mp4";
  const buttonLabel = isAudio ? "Upload Audio" : "Initiate Upload";
  const trimmedAssetName = assetName.trim();
  const uploadTarget = isAudio ? target.audioTarget : target.videoTarget;
  const {
    isUploading: isUploadingToTarget,
    isUploaded: isUploadedToTarget,
    uploadError: signedUploadError,
    clearUploadError: clearSignedUploadError,
    waitForUpload,
  } = useSignedAssetUpload({
    file: mediaFile,
    targetUrl: uploadTarget,
    contentType: acceptedMime,
  });
  const visibleUploadError = uploadError ?? signedUploadError;

  function resetUploadState() {
    setIsIngesting(false);
    setHasFirstResponse(false);
    setUploadPercentage(0);
  }

  function handleFileSelected(file: File) {
    setMediaFile(file);
    setAssetName(file.name);
    setTags([{ key: "", value: "" }]);
  }

  function updateTagKey(index: number, key: string) {
    setTags((currentTags) =>
      currentTags.map((tag, tagIndex) =>
        tagIndex === index ? { ...tag, key } : tag,
      ),
    );
  }

  function updateTagValue(index: number, value: string) {
    setTags((currentTags) =>
      currentTags.map((tag, tagIndex) =>
        tagIndex === index ? { ...tag, value } : tag,
      ),
    );
  }

  function addTag() {
    setTags((currentTags) => [...currentTags, { key: "", value: "" }]);
  }

  const handleUpload: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!mediaFile || trimmedAssetName.length === 0) {
      throw new Error(`upload must have a ${mediaType} set`);
    }
    setIsIngesting(true);
    setHasFirstResponse(false);
    setUploadPercentage(0);
    setUploadError(null);
    try {
      if (!isUploadedToTarget) {
        const uploaded = await waitForUpload();
        if (!uploaded) {
          resetUploadState();
          return;
        }
      }

      if (isAudio) {
        const request = create(InitiateAudioIngestRequestSchema, {
          workspaceId,
          parentDirectoryId,
          assetId: target.id,
          title: trimmedAssetName,
          // TODO: pass tags once the backend accepts asset tags during ingest.
        });
        for await (const response of filesClient.initiateAudioIngest(request)) {
          setHasFirstResponse(true);
          switch (response.ingestStatus.case) {
            case "ongoing":
              setUploadPercentage(
                response.ingestStatus.value.completionPercentage,
              );
              break;
            case "finished":
              onUploadCompleted(response.ingestStatus.value.assetId);
              resetUploadState();
              break;
          }
        }
      } else {
        const request = create(InitiateVideoIngestRequestSchema, {
          workspaceId,
          parentDirectoryId,
          assetId: target.id,
          title: trimmedAssetName,
          // TODO: pass tags once the backend accepts asset tags during ingest.
        });
        for await (const response of filesClient.initiateVideoIngest(request)) {
          setHasFirstResponse(true);
          switch (response.ingestStatus.case) {
            case "ongoing":
              setUploadPercentage(
                response.ingestStatus.value.completionPercentage,
              );
              break;
            case "finished":
              onUploadCompleted(response.ingestStatus.value.assetId);
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
  };

  return (
    <div>
      {isIngesting ? (
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
            onFileSelected={handleFileSelected}
            selectedFile={mediaFile}
            accept={acceptedMime}
            label={uploadLabel}
            isAcceptedFile={(file) => file.type === acceptedMime}
          />
          {mediaFile !== null && (
            <UploadForm
              assetName={assetName}
              tags={tags}
              submitLabel={
                isUploadingToTarget ? "Upload When Ready" : buttonLabel
              }
              disabled={trimmedAssetName.length === 0}
              onAssetNameChange={setAssetName}
              onTagKeyChange={updateTagKey}
              onTagValueChange={updateTagValue}
              onAddTag={addTag}
              onSubmit={handleUpload}
            />
          )}
        </>
      )}
      <Dialog
        open={visibleUploadError !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUploadError(null);
            clearSignedUploadError();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error uploading</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {visibleUploadError}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
