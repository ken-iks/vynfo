import { Card, CardContent } from "@/components/ui/card";
import { UploadWizard } from "./UploadWizard";

interface MediaHolderProps {
  projectId: string;
  onUploadCompleted: () => void;
}

export function MediaHolder({
  projectId,
  onUploadCompleted,
}: MediaHolderProps) {
  return (
    <Card className="mx-auto w-1/2">
      <CardContent className="space-y-8">
        <UploadWizard
          projectId={projectId}
          onUploadCompleted={onUploadCompleted}
        />
      </CardContent>
    </Card>
  );
}
