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
  type VfsTreeRow,
} from "../vfsTypes";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

export function useVfs() {
  const { currentWorkspaceId } = useWorkspaceContext();
  const [snapshots, setSnapshots] = useState<
    Record<string, VfsDirectorySnapshot>
  >({});
  const [expandedDirectoryIds, setExpandedDirectoryIds] = useState<string[]>(
    [],
  );
  const [loadingDirectoryIds, setLoadingDirectoryIds] = useState<string[]>([]);
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

  const rootSnapshot = snapshots[directoryKey(undefined)];
  const treeRows = useMemo(() => {
    const buildRows = (
      snapshot: VfsDirectorySnapshot | undefined,
      depth: number,
    ): VfsTreeRow[] => {
      if (!snapshot) return [];

      return snapshotEntries(snapshot).flatMap((entry) => {
        const expanded =
          entry.entryType === "directory" &&
          expandedDirectoryIds.includes(entry.id);
        const loading =
          entry.entryType === "directory" &&
          loadingDirectoryIds.includes(entry.id);
        const row = { entry, depth, expanded, loading };

        if (entry.entryType !== "directory" || !expanded) return [row];

        return [
          row,
          ...buildRows(snapshots[directoryKey(entry.id)], depth + 1),
        ];
      });
    };

    return buildRows(rootSnapshot, 0);
  }, [expandedDirectoryIds, loadingDirectoryIds, rootSnapshot, snapshots]);

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

  const refreshVisibleDirectories = useCallback(async () => {
    setLoading(true);
    try {
      const directoryIds = [undefined, ...expandedDirectoryIds];
      await Promise.all(
        directoryIds.map((directoryId) => fetchDirectory(directoryId)),
      );
    } catch (err) {
      setOperationError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [expandedDirectoryIds, fetchDirectory]);

  useEffect(() => {
    setSnapshots({});
    setExpandedDirectoryIds([]);
    setLoadingDirectoryIds([]);
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    void refreshVisibleDirectories();
  }, [currentWorkspaceId, refreshVisibleDirectories]);

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

  const toggleDirectory = async (entry: VfsEntry) => {
    if (entry.entryType !== "directory") return;
    const expanded = expandedDirectoryIds.includes(entry.id);
    if (expanded) {
      setExpandedDirectoryIds((current) =>
        current.filter((directoryId) => directoryId !== entry.id),
      );
      return;
    }

    setExpandedDirectoryIds((current) =>
      current.includes(entry.id) ? current : [...current, entry.id],
    );
    if (snapshots[directoryKey(entry.id)]) return;

    setLoadingDirectoryIds((current) =>
      current.includes(entry.id) ? current : [...current, entry.id],
    );
    try {
      await fetchDirectory(entry.id);
    } catch (err) {
      setOperationError(errorMessage(err));
    } finally {
      setLoadingDirectoryIds((current) =>
        current.filter((directoryId) => directoryId !== entry.id),
      );
    }
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
      await refreshVisibleDirectories();
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
      await refreshVisibleDirectories();
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
      await refreshVisibleDirectories();
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
      await refreshVisibleDirectories();
    });
  };

  return {
    addEntryToProject,
    busyAction,
    closeCreateFolder,
    closeUpload,
    createFolderOpen,
    currentWorkspaceId,
    deleteEntry,
    handleCreateFolder,
    handleDelete,
    handleMove,
    handleRename,
    loading,
    moveEntry,
    openCreateFolder,
    openUpload,
    operationError,
    projects,
    refreshVisibleDirectories,
    renameEntry,
    setDeleteEntry,
    setMoveEntry,
    setOperationError,
    setRenameEntry,
    toggleDirectory,
    treeRows,
    uploadOpen,
    uploadParentDirectoryId,
  };
}
