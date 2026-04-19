import { useState } from "react";
import { useSnapshot } from "valtio";
import { editorStore } from "../stores/editor";
import { EditorTimelineSection } from "./EditorTimelineSection";
import { formatDuration } from "@/lib/utils";
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

interface EditorTimelineProps {
  projectId: string;
  branchName: string;
  tipCommitId: string | undefined;
  onCommitSuccess: (newCommitId: string) => void;
}

export function EditorTimeline({
  projectId,
  branchName,
  tipCommitId,
  onCommitSuccess,
}: EditorTimelineProps) {
  const snap = useSnapshot(editorStore);
  const totalDuration = snap.totalDurationMillis;

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

  if (snap.sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Add a video to get started
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 gap-1">
        {snap.sections.map((section, i) => {
          const sectionDuration =
            section.endTimeMillis - section.startTimeMillis;
          const widthPercent =
            totalDuration > 0n
              ? Number((sectionDuration * 10000n) / totalDuration) / 100
              : 0;

          return (
            <EditorTimelineSection
              key={i}
              section={section}
              index={i}
              isSelected={snap.selectedSectionIndex === i}
              widthPercent={widthPercent}
            />
          );
        })}
      </div>
      <div className="flex justify-between items-center px-2 py-1">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Save</Button>
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
        <span className="text-xs text-muted-foreground">
          {formatDuration(Number(totalDuration))}
        </span>
      </div>
    </div>
  );
}
