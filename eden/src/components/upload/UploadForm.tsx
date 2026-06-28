import type { SubmitEventHandler } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface UploadTag {
  key: string;
  value: string;
}

interface UploadFormProps {
  assetName: string;
  tags: UploadTag[];
  submitLabel: string;
  disabled: boolean;
  onAssetNameChange: (assetName: string) => void;
  onTagKeyChange: (index: number, key: string) => void;
  onTagValueChange: (index: number, value: string) => void;
  onAddTag: () => void;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
}

export function UploadForm({
  assetName,
  tags,
  submitLabel,
  disabled,
  onAssetNameChange,
  onTagKeyChange,
  onTagValueChange,
  onAddTag,
  onSubmit,
}: UploadFormProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="asset-name">Name</Label>
        <Input
          id="asset-name"
          value={assetName}
          onChange={(event) => onAssetNameChange(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        {tags.map((tag, index) => (
          <div className="grid grid-cols-2 gap-2" key={index}>
            <Input
              value={tag.key}
              onChange={(event) => onTagKeyChange(index, event.target.value)}
              placeholder="Key"
            />
            <Input
              value={tag.value}
              onChange={(event) => onTagValueChange(index, event.target.value)}
              placeholder="Value"
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onAddTag}>
          Add Tag
        </Button>
      </div>
      <Button type="submit" disabled={disabled} size="sm">
        {submitLabel}
      </Button>
    </form>
  );
}
