import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VfsOperationErrorDialogueProps = {
  error: string;
  onOpenChange: (open: boolean) => void;
};

export function VfsOperationErrorDialogue({
  error,
  onOpenChange,
}: VfsOperationErrorDialogueProps) {
  return (
    <Dialog open={error !== ""} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filesystem action failed</DialogTitle>
          <DialogDescription className="break-words whitespace-pre-wrap">
            {error}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
