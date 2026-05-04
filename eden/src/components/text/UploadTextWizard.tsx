import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { editorStore } from "../stores/editor";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownViewer } from "./MarkdownViewer";

interface UploadTextWizardProps {
  onTextAdded: () => void;
}

export function UploadTextWizard({ onTextAdded }: UploadTextWizardProps) {
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAddText() {
    if (!markdown.trim()) return;

    setError(null);
    if (!editorStore.addTextOverlay(markdown)) {
      setError("Select or play a video section before adding text.");
      return;
    }
    onTextAdded();
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="grid min-h-[320px] grid-cols-2 gap-3">
        <MarkdownEditor value={markdown} onValueChange={setMarkdown} />
        <MarkdownViewer value={markdown} />
      </div>
      <div className="flex justify-center">
        <Button onClick={handleAddText} disabled={!markdown.trim()} size="sm">
          Add Text
        </Button>
      </div>
      <Dialog
        open={error !== null}
        onOpenChange={(open) => {
          if (!open) setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error adding text</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {error}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
