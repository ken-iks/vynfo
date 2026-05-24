import type { CommitMetadata } from "@/gen/proto/v1/projects_pb";
import { client } from "@/lib/client";
import {
  formatTimestampDate,
  formatTimestampTime,
} from "@/utils/timestamp-conversaions";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface CommitSelectProps {
  projectId: string;
  branchId: string | undefined;
  value: string;
  onValueChange: (commitId: string) => void;
  active: boolean;
  disabled: boolean;
}

function commitLabel(commit: CommitMetadata): string {
  if (!commit.createdAt) return commit.message;

  return `${commit.message} (${formatTimestampDate(commit.createdAt)} ${formatTimestampTime(commit.createdAt)})`;
}

export function CommitSelect({
  projectId,
  branchId,
  value,
  onValueChange,
  active,
  disabled,
}: CommitSelectProps) {
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [commits, setCommits] = useState<CommitMetadata[]>([]);
  const [commitsError, setCommitsError] = useState("");

  useEffect(() => {
    if (!active) return;

    if (!branchId) {
      setCommits([]);
      onValueChange("");
      return;
    }

    let ignore = false;
    setIsLoadingCommits(true);
    setCommitsError("");
    setCommits([]);
    onValueChange("");

    const loadCommits = async () => {
      try {
        const res = await client.listCommits({
          projectId,
          branchId,
        });
        if (ignore) return;
        setCommits(res.commits);
        onValueChange(res.commits[0]?.id ?? "");
      } catch (e) {
        if (ignore) return;
        setCommitsError(
          e instanceof Error ? e.message : "Failed to load commits",
        );
      } finally {
        if (!ignore) {
          setIsLoadingCommits(false);
        }
      }
    };

    void loadCommits();

    return () => {
      ignore = true;
    };
  }, [active, branchId, onValueChange, projectId]);

  return (
    <>
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || isLoadingCommits || commits.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={isLoadingCommits ? "Loading commits..." : "Select a commit"}
          />
        </SelectTrigger>
        <SelectContent>
          {commits.map((commit) => (
            <SelectItem key={commit.id} value={commit.id}>
              {commitLabel(commit)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoadingCommits && commits.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No commits are available for this branch.
        </p>
      )}
      {commitsError && (
        <p className="text-xs text-destructive">{commitsError}</p>
      )}
    </>
  );
}
