import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DocumentIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { client, filesClient } from "@/lib/client";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { SectionTitle } from "@/components/shared/SectionTitle";
import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { VfsMoveDialog } from "./VfsMoveDialog";
import { VfsNameDialog } from "./VfsNameDialog";
import { VfsUploadDialog } from "./VfsUploadDialog";
import {
  directoryKey,
  snapshotAssetIds,
  snapshotEntries,
  type VfsDirectorySnapshot,
  type VfsEntry,
  type VfsPathSegment,
} from "./vfsTypes";

export function Vfs() {
  const { currentWorkspaceId } = useWorkspaceContext();
  const [path, setPath] = useState<VfsPathSegment[]>([]);
  const [snapshots, setSnapshots] = useState<
    Record<string, VfsDirectorySnapshot>
  >({});
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameEntry, setRenameEntry] = useState<VfsEntry>();
  const [moveEntry, setMoveEntry] = useState<VfsEntry>();
  const [deleteEntry, setDeleteEntry] = useState<VfsEntry>();
  const [busyAction, setBusyAction] = useState("");

  const currentDirectoryId = path.at(-1)?.id;
  const currentKey = directoryKey(currentDirectoryId);
  const currentSnapshot = snapshots[currentKey];
  const currentEntries = useMemo(
    () => (currentSnapshot ? snapshotEntries(currentSnapshot) : []),
    [currentSnapshot],
  );

  const currentProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  const errorMessage = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

  const fetchDirectory = useCallback(
    async (directoryId: string | undefined) => {
      if (!currentWorkspaceId) return undefined;
      const response = directoryId
        ? await filesClient.getDirectoryChildren({
            workspaceId: currentWorkspaceId,
            directoryId,
          })
        : await filesClient.getRootDirectory({
            workspaceId: currentWorkspaceId,
          });
      const snapshot: VfsDirectorySnapshot = {
        directories: response.directories,
        videos: response.videos,
        images: response.images,
        audios: response.audios,
      };
      setSnapshots((current) => ({
        ...current,
        [directoryKey(directoryId)]: snapshot,
      }));
      return snapshot;
    },
    [currentWorkspaceId],
  );

  const refreshCurrentDirectory = useCallback(async () => {
    setLoading(true);
    try {
      await fetchDirectory(currentDirectoryId);
    } catch (err) {
      setOperationError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentDirectoryId, fetchDirectory]);

  useEffect(() => {
    setPath([]);
    setSnapshots({});
    setSelectedProjectId("");
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    void refreshCurrentDirectory();
  }, [currentWorkspaceId, refreshCurrentDirectory]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!currentWorkspaceId) {
        setProjects([]);
        return;
      }
      const response = await client.listProjects({
        workspaceId: currentWorkspaceId,
      });
      setProjects(response.projects);
      setSelectedProjectId((current) => {
        if (response.projects.some((project) => project.id === current)) {
          return current;
        }
        return response.projects[0]?.id ?? "";
      });
    };
    void loadProjects();
  }, [currentWorkspaceId]);

  const openDirectory = async (entry: VfsEntry) => {
    if (entry.entryType !== "directory") return;
    setPath((current) => [...current, { id: entry.id, name: entry.name }]);
  };

  const runAction = async (actionName: string, action: () => Promise<void>) => {
    setBusyAction(actionName);
    setOperationError("");
    try {
      await action();
    } catch (err) {
      setOperationError(errorMessage(err));
    } finally {
      setBusyAction("");
    }
  };

  const addAssetToProject = async (assetId: string) => {
    if (!selectedProjectId) {
      setOperationError("Select a target project before adding assets.");
      return;
    }
    await runAction(`add:${assetId}`, async () => {
      await client.addProjectAsset({
        projectId: selectedProjectId,
        assetId,
      });
    });
  };

  const collectDirectoryAssetIds = useCallback(
    async (directoryId: string): Promise<string[]> => {
      const snapshot = await fetchDirectory(directoryId);
      if (!snapshot) return [];
      const childAssetIds = await Promise.all(
        snapshot.directories.map((directory) =>
          collectDirectoryAssetIds(directory.id),
        ),
      );
      // The API returns one directory at a time, so directory-level project adds
      // intentionally walk children from the client until backend batch support exists.
      return [...snapshotAssetIds(snapshot), ...childAssetIds.flat()];
    },
    [fetchDirectory],
  );

  const addDirectoryToProject = async (directoryId: string) => {
    if (!selectedProjectId) {
      setOperationError("Select a target project before adding assets.");
      return;
    }
    await runAction(`add-directory:${directoryId}`, async () => {
      const assetIds = await collectDirectoryAssetIds(directoryId);
      await Promise.all(
        assetIds.map((assetId) =>
          client.addProjectAsset({
            projectId: selectedProjectId,
            assetId,
          }),
        ),
      );
    });
  };

  const handleCreateFolder = async (name: string) => {
    await runAction("create-folder", async () => {
      await filesClient.createDirectory({
        workspaceId: currentWorkspaceId,
        parentDirectoryId: currentDirectoryId,
        name,
      });
      await refreshCurrentDirectory();
    });
  };

  const handleRename = async (name: string) => {
    if (!renameEntry) return;
    await runAction(`rename:${renameEntry.id}`, async () => {
      if (renameEntry.entryType === "directory") {
        await filesClient.renameDirectory({
          workspaceId: currentWorkspaceId,
          directoryId: renameEntry.id,
          name,
        });
      } else {
        await filesClient.renameAsset({
          workspaceId: currentWorkspaceId,
          assetId: renameEntry.id,
          name,
        });
      }
      await refreshCurrentDirectory();
    });
  };

  const handleMove = async (parentDirectoryId: string | undefined) => {
    if (!moveEntry) return;
    await runAction(`move:${moveEntry.id}`, async () => {
      if (moveEntry.entryType === "directory") {
        await filesClient.moveDirectory({
          workspaceId: currentWorkspaceId,
          directoryId: moveEntry.id,
          newParentDirectory: parentDirectoryId,
        });
      } else {
        await filesClient.moveAsset({
          workspaceId: currentWorkspaceId,
          assetId: moveEntry.id,
          newParentDirectory: parentDirectoryId,
        });
      }
      await refreshCurrentDirectory();
    });
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    await runAction(`delete:${deleteEntry.id}`, async () => {
      if (deleteEntry.entryType === "directory") {
        await filesClient.deleteDirectory({
          workspaceId: currentWorkspaceId,
          directoryId: deleteEntry.id,
        });
      } else {
        await filesClient.deleteAsset({
          workspaceId: currentWorkspaceId,
          assetId: deleteEntry.id,
        });
      }
      setDeleteEntry(undefined);
      await refreshCurrentDirectory();
    });
  };

  return (
    <div className="space-y-4 px-12 pt-12">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle>Filesystem</SectionTitle>
        <div className="flex items-center gap-2">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Target project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateFolderOpen(true)}
            disabled={!currentWorkspaceId}
          >
            New Folder
          </Button>
          <Button
            type="button"
            onClick={() => setUploadOpen(true)}
            disabled={!currentWorkspaceId}
          >
            Upload
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Current Folder</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={path.length === 0 ? "default" : "ghost"}
              onClick={() => setPath([])}
            >
              Root
            </Button>
            {path.map((segment, index) => (
              <Button
                key={segment.id}
                type="button"
                size="sm"
                variant={index === path.length - 1 ? "default" : "ghost"}
                onClick={() => setPath(path.slice(0, index + 1))}
              >
                {segment.name}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Use the row action menu for rename, move, delete, and project
            actions.
            {currentProject ? ` Target project: ${currentProject.name}.` : ""}
          </p>
        </CardHeader>
        <CardContent>
          {loading && !currentSnapshot ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading filesystem...
            </div>
          ) : currentEntries.length > 0 ? (
            <div className="overflow-hidden rounded border">
              {currentEntries.map((entry) => (
                <VfsEntryRow
                  key={`${entry.entryType}:${entry.id}`}
                  entry={entry}
                  busy={busyAction.endsWith(entry.id)}
                  onOpen={() => openDirectory(entry)}
                  onRename={() => setRenameEntry(entry)}
                  onMove={() => setMoveEntry(entry)}
                  onDelete={() => setDeleteEntry(entry)}
                  onAddAsset={() => {
                    if (entry.entryType === "asset") {
                      void addAssetToProject(entry.id);
                    }
                  }}
                  onAddDirectory={() => {
                    if (entry.entryType === "directory") {
                      void addDirectoryToProject(entry.id);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              This folder is empty.
            </div>
          )}
        </CardContent>
      </Card>

      <VfsNameDialog
        open={createFolderOpen}
        title="Create Folder"
        submitLabel="Create"
        onOpenChange={setCreateFolderOpen}
        onSubmit={handleCreateFolder}
      />
      <VfsNameDialog
        open={renameEntry !== undefined}
        title="Rename"
        initialName={renameEntry?.name}
        submitLabel="Rename"
        onOpenChange={(open) => {
          if (!open) setRenameEntry(undefined);
        }}
        onSubmit={handleRename}
      />
      <VfsMoveDialog
        open={moveEntry !== undefined}
        workspaceId={currentWorkspaceId}
        title={`Move ${moveEntry?.name ?? "entry"}`}
        onOpenChange={(open) => {
          if (!open) setMoveEntry(undefined);
        }}
        onMove={handleMove}
      />
      <VfsUploadDialog
        open={uploadOpen}
        workspaceId={currentWorkspaceId}
        parentDirectoryId={currentDirectoryId}
        onOpenChange={setUploadOpen}
        onUploadCompleted={() => void refreshCurrentDirectory()}
      />
      <DeleteDialog
        entry={deleteEntry}
        deleting={busyAction.startsWith("delete:")}
        onOpenChange={(open) => {
          if (!open) setDeleteEntry(undefined);
        }}
        onConfirm={handleDelete}
      />
      <Dialog
        open={operationError !== ""}
        onOpenChange={(open) => {
          if (!open) setOperationError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filesystem action failed</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {operationError}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VfsEntryRow({
  entry,
  busy,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onAddAsset,
  onAddDirectory,
}: {
  entry: VfsEntry;
  busy: boolean;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddAsset: () => void;
  onAddDirectory: () => void;
}) {
  const icon =
    entry.entryType === "directory" ? (
      <FolderIcon className="size-5 text-amber-500" />
    ) : entry.kind === "video" ? (
      <VideoCameraIcon className="size-5 text-sky-500" />
    ) : entry.kind === "image" ? (
      <PhotoIcon className="size-5 text-emerald-500" />
    ) : entry.kind === "audio" ? (
      <SpeakerWaveIcon className="size-5 text-violet-500" />
    ) : (
      <DocumentIcon className="size-5 text-muted-foreground" />
    );
  const kindLabel = entry.entryType === "directory" ? "Folder" : entry.kind;

  return (
    <div className="flex items-center border-b last:border-b-0 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="flex w-full items-center gap-3 px-3 py-3 text-left disabled:opacity-50"
          onClick={entry.entryType === "directory" ? onOpen : undefined}
          disabled={busy}
        >
          {icon}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.name}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {kindLabel}
            </p>
          </div>
          {entry.entryType === "directory" && (
            <span className="text-xs text-muted-foreground">Open</span>
          )}
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mr-2 size-8 shrink-0"
            disabled={busy}
            onClick={(event) => event.stopPropagation()}
          >
            <EllipsisVerticalIcon className="size-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {entry.entryType === "directory" && (
            <DropdownMenuItem onSelect={onOpen}>Open</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={onMove}>Move</DropdownMenuItem>
          <DropdownMenuSeparator />
          {entry.entryType === "directory" ? (
            <DropdownMenuItem onSelect={onAddDirectory}>
              Add Folder Assets to Project
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={onAddAsset}>
              Add to Project
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DeleteDialog({
  entry,
  deleting,
  onOpenChange,
  onConfirm,
}: {
  entry: VfsEntry | undefined;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={entry !== undefined} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {entry?.name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the {entry?.entryType ?? "entry"}. The
            server will block deletion if any asset is still attached to a
            project.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
