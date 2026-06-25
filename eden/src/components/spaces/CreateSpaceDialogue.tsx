import type { SubmitEventHandler } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface CreateSpaceDialogueProps {
  creating: boolean;
  disabled: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  open: boolean;
}

export function CreateSpaceDialogue({
  creating,
  disabled,
  name,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
}: CreateSpaceDialogueProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        disabled={creating || disabled}
        onClick={() => onOpenChange(true)}
      >
        Create Review
      </Button>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New Space</DialogTitle>
            <DialogDescription>
              Give this collaboration space a name.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Design review"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || !name.trim() || disabled}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
