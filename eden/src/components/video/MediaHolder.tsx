import { Card, CardContent } from "@/components/ui/card";
import { UploadWizard } from "./UploadWizard";

interface MediaHolderProps {
  projectId: string;
  mediaType?: "audio" | "video";
  onUploadCompleted: () => void;
}

export function MediaHolder({
  projectId,
  mediaType = "video",
  onUploadCompleted,
}: MediaHolderProps) {
  return (
    <Card className="mx-auto w-1/2">
      <CardContent className="space-y-8">
        <UploadWizard
          projectId={projectId}
          mediaType={mediaType}
          onUploadCompleted={onUploadCompleted}
        />
      </CardContent>
    </Card>
  );
}
