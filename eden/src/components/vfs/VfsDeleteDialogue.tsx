import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VfsEntry } from "./vfsTypes";

type VfsDeleteDialogueProps = {
  entry: VfsEntry | undefined;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function VfsDeleteDialogue({
  entry,
  deleting,
  onOpenChange,
  onConfirm,
}: VfsDeleteDialogueProps) {
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
