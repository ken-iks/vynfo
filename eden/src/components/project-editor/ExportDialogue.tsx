import { client } from "@/lib/client";
import { useState } from "react";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { CommitSelect } from "./CommitSelect";

interface ExportDialogueProps {
  projectId: string;
  branchId: string | undefined;
  branchName: string;
}

export function ExportDialogue({
  projectId,
  branchId,
  branchName,
}: ExportDialogueProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportUrl, setExportUrl] = useState("");

  const { currentWorkspaceId } = useWorkspaceContext();

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      setExportError("");
      setExportUrl("");
    }
  };

  const handleExport = async () => {
    if (!currentWorkspaceId) {
      setExportError("Select a workspace before exporting.");
      return;
    }
    if (!selectedCommitId) {
      setExportError("Select a commit before exporting.");
      return;
    }

    setIsExporting(true);
    setExportError("");
    setExportUrl("");
    try {
      const res = await client.exportProject({
        projectId,
        workspaceId: currentWorkspaceId,
        commitId: selectedCommitId,
      });
      setExportUrl(res.signedUrlForDownload);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export commit</DialogTitle>
          <DialogDescription>
            Choose a commit from {branchName} to export. The download link will
            appear here when it is ready.
          </DialogDescription>
        </DialogHeader>
        <CommitSelect
          projectId={projectId}
          branchId={branchId}
          value={selectedCommitId}
          onValueChange={setSelectedCommitId}
          active={dialogOpen}
          disabled={isExporting}
        />
        {exportError && (
          <p className="text-xs text-destructive">{exportError}</p>
        )}
        {exportUrl && (
          <Button asChild>
            <a href={exportUrl} download>
              Download export
            </a>
          </Button>
        )}
        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={isExporting || !selectedCommitId}
          >
            {isExporting ? "Exporting..." : "Confirm export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
