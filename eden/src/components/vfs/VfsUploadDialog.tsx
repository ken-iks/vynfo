import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadImageWizard } from "@/components/video/UploadImageWizard";
import { UploadWizard } from "@/components/video/UploadWizard";

type UploadKind = "video" | "audio" | "image";

type VfsUploadDialogProps = {
  open: boolean;
  workspaceId: string;
  parentDirectoryId?: string;
  onOpenChange: (open: boolean) => void;
  onUploadCompleted: () => void;
};

export function VfsUploadDialog({
  open,
  workspaceId,
  parentDirectoryId,
  onOpenChange,
  onUploadCompleted,
}: VfsUploadDialogProps) {
  const [uploadKind, setUploadKind] = useState<UploadKind>("video");

  const handleCompleted = () => {
    onUploadCompleted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload to Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select
            value={uploadKind}
            onValueChange={(value) => {
              if (value === "video" || value === "audio" || value === "image") {
                setUploadKind(value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
          {uploadKind === "image" ? (
            <UploadImageWizard
              workspaceId={workspaceId}
              parentDirectoryId={parentDirectoryId}
              onUploadCompleted={handleCompleted}
            />
          ) : (
            <UploadWizard
              workspaceId={workspaceId}
              parentDirectoryId={parentDirectoryId}
              mediaType={uploadKind}
              onUploadCompleted={handleCompleted}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
