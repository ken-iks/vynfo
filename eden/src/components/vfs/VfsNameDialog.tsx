import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type VfsNameDialogProps = {
  open: boolean;
  title: string;
  initialName?: string;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
};

export function VfsNameDialog({
  open,
  title,
  initialName = "",
  submitLabel,
  onOpenChange,
  onSubmit,
}: VfsNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [initialName, open]);

  const trimmedName = name.trim();

  const handleSubmit = async () => {
    if (!trimmedName) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmedName);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSubmit();
          }}
          placeholder="Name"
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!trimmedName || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
