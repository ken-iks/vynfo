import { useState } from "react";
import { create } from "@bufbuild/protobuf";
import {
  MediaImageOverlaySchema,
  MediaPositionSchema,
  UploadImageRequestSchema,
} from "../../gen/proto/v1/projects_pb";
import { client } from "../../lib/client";
import { mediaAssetStore } from "../stores/mediaAssets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DragUploadArea } from "./DragUploadArea";
import { useAuth } from "../providers/AuthProvider";

interface UploadImageWizardProps {
  projectId: string;
  onUploadCompleted: () => void;
}

export function UploadImageWizard({
  projectId,
  onUploadCompleted,
}: UploadImageWizardProps) {
  const userId = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload() {
    if (!imageFile) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const response = await client.uploadImage(
        create(UploadImageRequestSchema, {
          userId,
          projectId,
          content: new Uint8Array(await imageFile.arrayBuffer()),
          title: title.trim() || imageFile.name,
          meta: create(MediaImageOverlaySchema, {
            pos: create(MediaPositionSchema, {
              leftCornerPx: 32n,
              leftCornerPy: 32n,
              size: 160n,
            }),
          }),
        }),
      );
      mediaAssetStore.setImageUrl(
        response.uploadedAssetId,
        URL.createObjectURL(imageFile),
      );
      onUploadCompleted();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Image title"
      />
      <DragUploadArea
        onFileSelected={setImageFile}
        selectedFile={imageFile}
        accept="image/*"
        label="Upload Image"
        isAcceptedFile={(file) => file.type.startsWith("image/")}
      />
      {imageFile !== null && (
        <div className="flex justify-center">
          <Button onClick={handleUpload} disabled={isUploading} size="sm">
            {isUploading ? "Uploading..." : "Upload Image"}
          </Button>
        </div>
      )}
      <Dialog
        open={uploadError !== null}
        onOpenChange={(open) => {
          if (!open) setUploadError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error uploading image</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {uploadError}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
