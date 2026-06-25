import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { client, filesClient } from "@/lib/client";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import {
  directoryKey,
  snapshotAssetIds,
  snapshotEntries,
  type VfsDirectorySnapshot,
  type VfsEntry,
  type VfsPathSegment,
} from "../vfsTypes";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

export function useVfs() {
  const { currentWorkspaceId } = useWorkspaceContext();
  const [snapshots, setSnapshots] = useState<
    Record<string, VfsDirectorySnapshot>
  >({});
  const [currentPath, setCurrentPath] = useState<VfsPathSegment[]>([]);
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderParentDirectoryId, setCreateFolderParentDirectoryId] =
    useState<string>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadParentDirectoryId, setUploadParentDirectoryId] =
    useState<string>();
  const [renameEntry, setRenameEntry] = useState<VfsEntry>();
  const [moveEntry, setMoveEntry] = useState<VfsEntry>();
  const [deleteEntry, setDeleteEntry] = useState<VfsEntry>();
  const [busyAction, setBusyAction] = useState("");

  const currentDirectoryId = currentPath.at(-1)?.id;
  const currentSnapshot = snapshots[directoryKey(currentDirectoryId)];
  const currentEntries = useMemo(
    () => (currentSnapshot ? snapshotEntries(currentSnapshot) : []),
    [currentSnapshot],
  );

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

  const refreshDirectory = useCallback(
    async (directoryId: string | undefined) => {
      try {
        await fetchDirectory(directoryId);
      } catch (err) {
        setOperationError(errorMessage(err));
      }
    },
    [fetchDirectory],
  );

  const refreshCurrentDirectory = useCallback(
    () => refreshDirectory(currentDirectoryId),
    [currentDirectoryId, refreshDirectory],
  );

  useEffect(() => {
    setSnapshots({});
    setCurrentPath([]);
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    if (snapshots[directoryKey(currentDirectoryId)]) return;

    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        await fetchDirectory(currentDirectoryId);
      } catch (err) {
        if (!ignore) setOperationError(errorMessage(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [currentWorkspaceId, currentDirectoryId, snapshots, fetchDirectory]);

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
    };
    void loadProjects();
  }, [currentWorkspaceId]);

  const openDirectory = (entry: VfsEntry) => {
    if (entry.entryType !== "directory") return;
    setCurrentPath((current) => [
      ...current,
      { id: entry.id, name: entry.name },
    ]);
  };

  const navigateTo = (index: number) => {
    setCurrentPath((current) => current.slice(0, index + 1));
  };

  const navigateRoot = () => {
    setCurrentPath([]);
  };

  const openCreateFolder = (parentDirectoryId: string | undefined) => {
    setCreateFolderParentDirectoryId(parentDirectoryId);
    setCreateFolderOpen(true);
  };

  const closeCreateFolder = (open: boolean) => {
    setCreateFolderOpen(open);
    if (!open) setCreateFolderParentDirectoryId(undefined);
  };

  const openUpload = (parentDirectoryId: string | undefined) => {
    setUploadParentDirectoryId(parentDirectoryId);
    setUploadOpen(true);
  };

  const closeUpload = (open: boolean) => {
    setUploadOpen(open);
    if (!open) setUploadParentDirectoryId(undefined);
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

  const addAssetToProject = async (assetId: string, projectId: string) => {
    await runAction(`add:${assetId}`, async () => {
      await client.addProjectAsset({
        projectId,
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

  const addDirectoryToProject = async (
    directoryId: string,
    projectId: string,
  ) => {
    await runAction(`add-directory:${directoryId}`, async () => {
      const assetIds = await collectDirectoryAssetIds(directoryId);
      await Promise.all(
        assetIds.map((assetId) =>
          client.addProjectAsset({
            projectId,
            assetId,
          }),
        ),
      );
    });
  };

  const addEntryToProject = async (entry: VfsEntry, projectId: string) => {
    if (entry.entryType === "asset") {
      await addAssetToProject(entry.id, projectId);
      return;
    }
    await addDirectoryToProject(entry.id, projectId);
  };

  const handleCreateFolder = async (name: string) => {
    await runAction("create-folder", async () => {
      await filesClient.createDirectory({
        workspaceId: currentWorkspaceId,
        parentDirectoryId: createFolderParentDirectoryId,
        name,
      });
      await fetchDirectory(createFolderParentDirectoryId);
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
      await fetchDirectory(currentDirectoryId);
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
      await fetchDirectory(currentDirectoryId);
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
      await fetchDirectory(currentDirectoryId);
    });
  };

  return {
    addEntryToProject,
    busyAction,
    closeCreateFolder,
    closeUpload,
    createFolderOpen,
    currentDirectoryId,
    currentEntries,
    currentPath,
    currentWorkspaceId,
    deleteEntry,
    handleCreateFolder,
    handleDelete,
    handleMove,
    handleRename,
    loading,
    moveEntry,
    navigateRoot,
    navigateTo,
    openCreateFolder,
    openDirectory,
    openUpload,
    operationError,
    projects,
    refreshCurrentDirectory,
    refreshDirectory,
    renameEntry,
    setDeleteEntry,
    setMoveEntry,
    setOperationError,
    setRenameEntry,
    uploadParentDirectoryId,
    uploadOpen,
  };
}
