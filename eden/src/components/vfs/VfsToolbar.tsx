import { SectionTitle } from "@/components/shared/SectionTitle";
import { Button } from "@/components/ui/button";
import { SectionSubtitle } from "../shared/SectionSubtitle";

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
    <div className="flex items-center justify-between gap-4">
      <div>
        <SectionTitle>Vynfo File System </SectionTitle>
        <SectionSubtitle>
          {" "}
          Store files that can be used across all workspace projects and
          references from all spaces{" "}
        </SectionSubtitle>
      </div>
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
