import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { filesClient } from "@/lib/client";
import type { VfsDirectorySnapshot, VfsPathSegment } from "./vfsTypes";

type VfsMoveDialogProps = {
  open: boolean;
  workspaceId: string;
  title: string;
  onOpenChange: (open: boolean) => void;
  onMove: (parentDirectoryId: string | undefined) => Promise<void>;
};

export function VfsMoveDialog({
  open,
  workspaceId,
  title,
  onOpenChange,
  onMove,
}: VfsMoveDialogProps) {
  const [path, setPath] = useState<VfsPathSegment[]>([]);
  const [snapshot, setSnapshot] = useState<VfsDirectorySnapshot>();
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  const currentDirectoryId = path.at(-1)?.id;

  const loadDestination = useCallback(
    async (directoryId: string | undefined) => {
      if (!workspaceId) return;
      setLoading(true);
      try {
        const response = directoryId
          ? await filesClient.getDirectoryChildren({
              workspaceId,
              directoryId,
            })
          : await filesClient.getRootDirectory({ workspaceId });
        setSnapshot({
          directories: response.directories,
          videos: response.videos,
          images: response.images,
          audios: response.audios,
        });
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!open) return;
    setPath([]);
    void loadDestination(undefined);
  }, [loadDestination, open]);

  const handleMove = async () => {
    setMoving(true);
    try {
      await onMove(currentDirectoryId);
      onOpenChange(false);
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <Button
              type="button"
              size="sm"
              variant={path.length === 0 ? "default" : "ghost"}
              onClick={() => {
                setPath([]);
                void loadDestination(undefined);
              }}
            >
              Root
            </Button>
            {path.map((segment, index) => (
              <Button
                key={segment.id}
                type="button"
                size="sm"
                variant={index === path.length - 1 ? "default" : "ghost"}
                onClick={() => {
                  const nextPath = path.slice(0, index + 1);
                  setPath(nextPath);
                  void loadDestination(segment.id);
                }}
              >
                {segment.name}
              </Button>
            ))}
          </div>
          <div className="max-h-64 overflow-auto rounded border">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading folders...
              </div>
            ) : snapshot && snapshot.directories.length > 0 ? (
              snapshot.directories.map((directory) => (
                <button
                  key={directory.id}
                  type="button"
                  className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                  onClick={() => {
                    setPath((current) => [
                      ...current,
                      { id: directory.id, name: directory.name },
                    ]);
                    void loadDestination(directory.id);
                  }}
                >
                  <span>{directory.name}</span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No child folders.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={moving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={moving} onClick={handleMove}>
            {moving ? "Moving..." : "Move Here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
