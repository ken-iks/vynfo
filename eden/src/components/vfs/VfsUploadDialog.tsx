import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UploadImageWizard } from "@/components/upload/UploadImageWizard";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { filesClient } from "@/lib/client";

type UploadKind = "video" | "audio" | "image";

export interface UploadTarget {
  id: string;
  videoTarget: string;
  audioTarget: string;
}

interface VfsUploadDialogProps {
  open: boolean;
  workspaceId: string;
  parentDirectoryId?: string;
  onOpenChange: (open: boolean) => void;
  onUploadCompleted: () => void;
}

async function requestUploadTarget(workspaceId: string): Promise<UploadTarget> {
  const { assetId, audioTarget, videoTarget } =
    await filesClient.getAssetUploadTarget({ workspaceId });
  return { id: assetId, audioTarget, videoTarget };
}

export function VfsUploadDialog({
  open,
  workspaceId,
  parentDirectoryId,
  onOpenChange,
  onUploadCompleted,
}: VfsUploadDialogProps) {
  const [uploadKind, setUploadKind] = useState<UploadKind>("video");
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | undefined>(
    undefined,
  );
  const [uploadTargetError, setUploadTargetError] = useState<string | null>(
    null,
  );

  const handleCompleted = () => {
    onUploadCompleted();
    onOpenChange(false);
  };

  async function getUploadTarget() {
    setUploadTarget(undefined);
    setUploadTargetError(null);

    try {
      setUploadTarget(await requestUploadTarget(workspaceId));
    } catch (err) {
      setUploadTargetError(err instanceof Error ? err.message : String(err));
    }
  }

  // Once on mount we pre initialize the upload targets that are available for 2 mins
  useEffect(() => {
    let ignoreResponse = false;

    if (!open) {
      setUploadTarget(undefined);
      setUploadTargetError(null);
      return;
    }

    async function loadUploadTarget() {
      setUploadTarget(undefined);
      setUploadTargetError(null);

      try {
        const nextUploadTarget = await requestUploadTarget(workspaceId);
        if (!ignoreResponse) {
          setUploadTarget(nextUploadTarget);
        }
      } catch (err) {
        if (!ignoreResponse) {
          setUploadTargetError(
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }

    loadUploadTarget();

    return () => {
      ignoreResponse = true;
    };
  }, [open, workspaceId]);

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
          {uploadTargetError !== null ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <DialogHeader>
                <DialogTitle>Could not prepare upload</DialogTitle>
                <DialogDescription className="break-words whitespace-pre-wrap">
                  {uploadTargetError}
                </DialogDescription>
              </DialogHeader>
              <Button size="sm" variant="outline" onClick={getUploadTarget}>
                Try again
              </Button>
            </div>
          ) : uploadKind === "image" ? (
            <UploadImageWizard
              workspaceId={workspaceId}
              parentDirectoryId={parentDirectoryId}
              onUploadCompleted={handleCompleted}
            />
          ) : uploadTarget ? (
            <UploadWizard
              workspaceId={workspaceId}
              parentDirectoryId={parentDirectoryId}
              mediaType={uploadKind}
              onUploadCompleted={handleCompleted}
              target={uploadTarget}
            />
          ) : (
            <div className="flex items-center justify-center gap-2 py-6">
              <Spinner />
              <span className="text-sm text-muted-foreground">
                Preparing upload...
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
