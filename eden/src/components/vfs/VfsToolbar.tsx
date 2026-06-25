import { Button } from "@/components/ui/button";

type VfsToolbarProps = {
  disabled: boolean;
  onCreateFolder: () => void;
  onUpload: () => void;
};

export function VfsToolbar({
  disabled,
  onCreateFolder,
  onUpload,
}: VfsToolbarProps) {
  return (
    <div className="flex items-center justify-end gap-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCreateFolder}
          disabled={disabled}
        >
          New Folder
        </Button>
        <Button type="button" onClick={onUpload} disabled={disabled}>
          Upload
        </Button>
      </div>
    </div>
  );
}
