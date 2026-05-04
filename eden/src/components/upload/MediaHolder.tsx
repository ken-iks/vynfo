import { Card, CardContent } from "@/components/ui/card";
import { UploadWizard } from "./UploadWizard";

interface MediaHolderProps {
  workspaceId: string;
  parentDirectoryId?: string;
  mediaType?: "audio" | "video";
  onUploadCompleted: () => void;
}

export function MediaHolder({
  workspaceId,
  parentDirectoryId,
  mediaType = "video",
  onUploadCompleted,
}: MediaHolderProps) {
  return (
    <Card className="mx-auto w-1/2">
      <CardContent className="space-y-8">
        <UploadWizard
          workspaceId={workspaceId}
          parentDirectoryId={parentDirectoryId}
          mediaType={mediaType}
          onUploadCompleted={onUploadCompleted}
        />
      </CardContent>
    </Card>
  );
}
