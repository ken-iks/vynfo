import { Card, CardContent } from "@/components/ui/card";
import { useBreadcrumbs } from "@/components/Breadcrumbs";
import { VfsDeleteDialogue } from "./VfsDeleteDialogue";
import { VfsMoveDialog } from "./VfsMoveDialog";
import { VfsNameDialog } from "./VfsNameDialog";
import { VfsOperationErrorDialogue } from "./VfsOperationErrorDialogue";
import { VfsToolbar } from "./VfsToolbar";
import { VfsTree } from "./VfsTree";
import { VfsUploadDialog } from "./VfsUploadDialog";
import { useVfs } from "./hooks/useVfs";

export function Vfs() {
  const {
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
  } = useVfs();

  useBreadcrumbs([{ label: "Files" }]);

  return (
    <div className="space-y-4 px-12 pt-12">
      <VfsToolbar
        disabled={!currentWorkspaceId}
        onCreateFolder={() => openCreateFolder(undefined)}
        onUpload={() => openUpload(undefined)}
      />

      <Card>
        <CardContent>
          <VfsTree
            busyAction={busyAction}
            loading={loading}
            projects={projects}
            rows={treeRows}
            onAddToProject={(entry, projectId) =>
              void addEntryToProject(entry, projectId)
            }
            onDelete={setDeleteEntry}
            onMove={setMoveEntry}
            onRename={setRenameEntry}
            onCreateFolder={(entry) => openCreateFolder(entry.id)}
            onUpload={(entry) => openUpload(entry.id)}
            onToggleDirectory={(entry) => void toggleDirectory(entry)}
          />
        </CardContent>
      </Card>

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
        onUploadCompleted={() => void refreshVisibleDirectories()}
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
