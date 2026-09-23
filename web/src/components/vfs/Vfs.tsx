import { useBreadcrumbs } from "@/components/Breadcrumbs";
import { VfsDeleteDialogue } from "./VfsDeleteDialogue";
import { VfsMoveDialog } from "./VfsMoveDialog";
import { VfsNameDialog } from "./VfsNameDialog";
import { VfsOperationErrorDialogue } from "./VfsOperationErrorDialogue";
import { VfsToolbar } from "./VfsToolbar";
import { VfsGrid } from "./VfsGrid";
import { VfsUploadDialog } from "./VfsUploadDialog";
import { useVfs } from "./hooks/useVfs";

export function Vfs() {
  const {
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
    refreshDirectory,
    renameEntry,
    setDeleteEntry,
    setMoveEntry,
    setOperationError,
    setRenameEntry,
    uploadOpen,
    uploadParentDirectoryId,
  } = useVfs();

  useBreadcrumbs([
    { label: "Files", onClick: navigateRoot },
    ...currentPath.map((segment, index) => ({
      label: segment.name,
      onClick: () => navigateTo(index),
    })),
  ]);

  return (
    <div className="space-y-4 px-12 pt-12">
      <VfsToolbar
        disabled={!currentWorkspaceId}
        onCreateFolder={() => openCreateFolder(currentDirectoryId)}
        onUpload={() => openUpload(currentDirectoryId)}
      />

      <VfsGrid
        busyAction={busyAction}
        loading={loading}
        projects={projects}
        entries={currentEntries}
        onOpenDirectory={openDirectory}
        onAddToProject={(entry, projectId) =>
          void addEntryToProject(entry, projectId)
        }
        onDelete={setDeleteEntry}
        onMove={setMoveEntry}
        onRename={setRenameEntry}
        onCreateFolder={(entry) => openCreateFolder(entry.id)}
        onUpload={(entry) => openUpload(entry.id)}
      />

      <VfsNameDialog
        open={createFolderOpen}
        title="Create Folder"
        submitLabel="Create"
        onOpenChange={closeCreateFolder}
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
        parentDirectoryId={uploadParentDirectoryId}
        onOpenChange={closeUpload}
        onUploadCompleted={() => void refreshDirectory(uploadParentDirectoryId)}
      />
      <VfsDeleteDialogue
        entry={deleteEntry}
        deleting={busyAction.startsWith("delete:")}
        onOpenChange={(open) => {
          if (!open) setDeleteEntry(undefined);
        }}
        onConfirm={handleDelete}
      />
      <VfsOperationErrorDialogue
        error={operationError}
        onOpenChange={(open) => {
          if (!open) setOperationError("");
        }}
      />
    </div>
  );
}
