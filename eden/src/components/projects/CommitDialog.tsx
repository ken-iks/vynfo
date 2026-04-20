import { useState } from "react";
import { editorStore } from "../stores/editor";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { client } from "@/lib/client";
import { useAuth } from "../providers/AuthProvider";

interface CommitDialogProps {
  projectId: string;
  branchName: string;
  tipCommitId: string | undefined;
  disabled: boolean;
  onCommitSuccess: (newCommitId: string) => void;
}

export function CommitDialog({
  projectId,
  branchName,
  tipCommitId,
  disabled,
  onCommitSuccess,
}: CommitDialogProps) {
  const userId = useAuth();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    setCommitError("");
    try {
      const res = await client.commitEdit({
        projectId,
        branchName,
        commitMessage: commitMessage.trim(),
        previousCommitId: tipCommitId,
        commitState: [...editorStore.sections],
        userId,
      });
      if (res.response.case === "newCommitId") {
        onCommitSuccess(res.response.value);
        setCommitMessage("");
        setDialogOpen(false);
      } else if (res.response.case === "err") {
        setCommitError(
          "Branch is stale — someone else committed. Refresh and try again.",
        );
      }
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          Save
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit to {branchName}</DialogTitle>
          <DialogDescription>
            Describe what changed in this edit.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
        />
        {commitError && (
          <p className="text-xs text-destructive">{commitError}</p>
        )}
        <DialogFooter>
          <Button
            onClick={handleCommit}
            disabled={isCommitting || !commitMessage.trim()}
          >
            {isCommitting ? "Committing..." : "Commit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
