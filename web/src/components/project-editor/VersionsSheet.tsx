import { useEffect, useState } from "react";
import type {
  BranchMetadata,
  CommitMetadata,
} from "@/gen/proto/v1/projects_pb";
import { client } from "@/lib/client";
import {
  formatTimestampDate,
  formatTimestampTime,
} from "@/utils/timestamp-conversaions";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

interface VersionsSheetProps {
  projectId: string;
  branchId: string | undefined;
  selectedBranch: string;
  branches: BranchMetadata[];
  tipCommitId: string | undefined;
  onBranchChange: (branchName: string) => void;
  onRestore: (commitId: string) => Promise<void>;
}

export function VersionsSheet({
  projectId,
  branchId,
  selectedBranch,
  branches,
  tipCommitId,
  onBranchChange,
  onRestore,
}: VersionsSheetProps) {
  const [open, setOpen] = useState(false);
  const [commits, setCommits] = useState<CommitMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [restoringCommitId, setRestoringCommitId] = useState("");
  const [exportingCommitId, setExportingCommitId] = useState("");
  const [exportUrls, setExportUrls] = useState<Record<string, string>>({});
  const [exportError, setExportError] = useState("");

  const { currentWorkspaceId } = useWorkspaceContext();

  useEffect(() => {
    if (!open) return;

    if (!branchId) {
      setCommits([]);
      return;
    }

    let ignore = false;
    setIsLoading(true);
    setLoadError("");
    setExportUrls({});
    setExportError("");

    const load = async () => {
      try {
        const res = await client.listCommits({ projectId, branchId });
        if (ignore) return;
        setCommits(res.commits);
      } catch (e) {
        if (ignore) return;
        setLoadError(
          e instanceof Error ? e.message : "Failed to load versions",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [open, branchId, projectId]);

  const handleRestore = async (commitId: string) => {
    setRestoringCommitId(commitId);
    try {
      await onRestore(commitId);
      setOpen(false);
    } finally {
      setRestoringCommitId("");
    }
  };

  const handleExport = async (commitId: string) => {
    if (!currentWorkspaceId) {
      setExportError("Select a workspace before exporting.");
      return;
    }

    setExportingCommitId(commitId);
    setExportError("");
    try {
      const res = await client.exportProject({
        projectId,
        workspaceId: currentWorkspaceId,
        commitId,
      });
      setExportUrls((prev) => ({
        ...prev,
        [commitId]: res.signedUrlForDownload,
      }));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingCommitId("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" disabled={!branchId}>
          Versions
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Versions</SheetTitle>
          <SheetDescription>
            Switch branches, then browse, restore, or export commits.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Branch</span>
            <Select value={selectedBranch} onValueChange={onBranchChange}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipCommitId ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={exportingCommitId === tipCommitId}
                onClick={() => handleExport(tipCommitId)}
              >
                {exportingCommitId === tipCommitId
                  ? "Exporting..."
                  : "Export current"}
              </Button>
              {exportUrls[tipCommitId] ? (
                <Button asChild size="sm">
                  <a href={exportUrls[tipCommitId]} download>
                    Download
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
          {isLoading ? (
            <p className="text-muted-foreground">Loading versions...</p>
          ) : null}
          {loadError ? <p className="text-destructive">{loadError}</p> : null}
          {!isLoading && !loadError && commits.length === 0 ? (
            <p className="text-muted-foreground">
              No versions on this branch yet.
            </p>
          ) : null}
          {exportError ? (
            <p className="text-destructive">{exportError}</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {commits.map((commit) => {
              const isCurrent = commit.id === tipCommitId;
              const exportUrl = exportUrls[commit.id];
              return (
                <li key={commit.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {commit.message || "(no message)"}
                      </p>
                      {commit.createdAt ? (
                        <p className="text-muted-foreground">
                          {formatTimestampDate(commit.createdAt)}{" "}
                          {formatTimestampTime(commit.createdAt)}
                        </p>
                      ) : null}
                    </div>
                    {isCurrent ? (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isCurrent || restoringCommitId === commit.id}
                      onClick={() => handleRestore(commit.id)}
                    >
                      {restoringCommitId === commit.id
                        ? "Restoring..."
                        : "Restore"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={exportingCommitId === commit.id}
                      onClick={() => handleExport(commit.id)}
                    >
                      {exportingCommitId === commit.id
                        ? "Exporting..."
                        : "Export"}
                    </Button>
                    {exportUrl ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={exportUrl} download>
                          Download
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
