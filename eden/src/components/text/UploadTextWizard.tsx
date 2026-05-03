import { useState } from "react";
import { create } from "@bufbuild/protobuf";
import {
  MediaPositionSchema,
  MediaTextColor,
  MediaTextOverlaySchema,
  UploadTextRequestSchema,
} from "../../gen/proto/v1/projects_pb";
import { client } from "../../lib/client";
import { mediaAssetStore } from "../stores/mediaAssets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownViewer } from "./MarkdownViewer";

interface UploadTextWizardProps {
  projectId: string;
  onUploadCompleted: () => void;
}

export function UploadTextWizard({
  projectId,
  onUploadCompleted,
}: UploadTextWizardProps) {
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload() {
    if (!markdown.trim()) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const response = await client.uploadText(
        create(UploadTextRequestSchema, {
          project: projectId,
          content: markdown,
          title: title.trim() || "Markdown text",
          meta: create(MediaTextOverlaySchema, {
            color: MediaTextColor.WHITE,
            pos: create(MediaPositionSchema, {
              leftCornerPx: 32n,
              leftCornerPy: 32n,
              size: 240n,
            }),
          }),
        }),
      );
      mediaAssetStore.setTextMarkdown(response.uploadedAssetId, markdown);
      onUploadCompleted();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Text title"
      />
      <div className="grid min-h-[320px] grid-cols-2 gap-3">
        <MarkdownEditor value={markdown} onValueChange={setMarkdown} />
        <MarkdownViewer value={markdown} />
      </div>
      <div className="flex justify-center">
        <Button
          onClick={handleUpload}
          disabled={isUploading || !markdown.trim()}
          size="sm"
        >
          {isUploading ? "Uploading..." : "Upload Text"}
        </Button>
      </div>
      <Dialog
        open={uploadError !== null}
        onOpenChange={(open) => {
          if (!open) setUploadError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error uploading text</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {uploadError}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
