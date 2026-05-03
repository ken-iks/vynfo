import { useEffect, useState } from "react";
import type { ProjectMetadata } from "../../gen/proto/v1/projects_pb";
import { ProjectView } from "./detail/ProjectView";
import { ProjectConfigDropDown } from "./detail/ProjectConfigDropdown";
import { ProjectsList } from "./list/ProjectsList";
import { MediaHolder } from "../video/MediaHolder";
import { UploadImageWizard } from "../video/UploadImageWizard";
import { UploadTextWizard } from "../text/UploadTextWizard";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";

export type ProjectPage =
  | "list"
  | "view"
  | "uploadVideo"
  | "uploadAudio"
  | "uploadImage"
  | "uploadText";

function UploadFinishedNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg"
    >
      <CheckCircleIcon className="size-5 text-emerald-500" />
      {message}
    </div>
  );
}

export function Projects() {
  const { currentWorkspaceId } = useWorkspaceContext();
  const [projectPage, setProjectPage] = useState<ProjectPage>("list");
  const [selectedProject, setSelectedProject] = useState<ProjectMetadata>();
  const [uploadNotice, setUploadNotice] = useState<{
    message: string;
  } | null>(null);

  useEffect(() => {
    if (uploadNotice === null) return;

    const timeoutId = window.setTimeout(() => {
      setUploadNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [uploadNotice]);

  useEffect(() => {
    setProjectPage("list");
    setSelectedProject(undefined);
  }, [currentWorkspaceId]);

  const openProject = (project: ProjectMetadata) => {
    setSelectedProject(project);
    setProjectPage("view");
  };

  const showUploadNotice = (message: string) => {
    setUploadNotice({ message });
  };

  const uploadNoticeElement =
    uploadNotice !== null ? (
      <UploadFinishedNotice message={uploadNotice.message} />
    ) : null;

  switch (projectPage) {
    case "list":
      return <ProjectsList onSelect={openProject} />;
    case "view":
      return (
        <div className="relative h-full">
          {uploadNoticeElement}
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("list")}>
              <ArrowLeftIcon className="size-4" />
              Back to Projects
            </Button>
          </div>
          <div className="absolute top-2 right-8 z-10 flex flex-col items-stretch gap-2">
            <ProjectConfigDropDown handlePageSelection={setProjectPage} />
          </div>
          {selectedProject && <ProjectView project={selectedProject} />}
        </div>
      );
    case "uploadVideo":
      return (
        <div className="relative h-full">
          {uploadNoticeElement}
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          {selectedProject ? (
            <MediaHolder
              projectId={selectedProject.id}
              onUploadCompleted={() =>
                showUploadNotice("Video upload finished")
              }
            />
          ) : null}
        </div>
      );
    case "uploadAudio":
      return (
        <div className="relative h-full">
          {uploadNoticeElement}
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          {selectedProject ? (
            <MediaHolder
              projectId={selectedProject.id}
              mediaType="audio"
              onUploadCompleted={() =>
                showUploadNotice("Audio upload finished")
              }
            />
          ) : null}
        </div>
      );
    case "uploadImage":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          <div className="flex h-full justify-center px-12 pt-20">
            <Card className="h-fit w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Upload Image</CardTitle>
                <CardDescription>
                  Add an image asset that can be positioned on the editor
                  canvas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedProject ? (
                  <UploadImageWizard
                    projectId={selectedProject.id}
                    onUploadCompleted={() => {
                      showUploadNotice("Image upload finished");
                      setProjectPage("view");
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    case "uploadText":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          <div className="flex h-full justify-center px-12 pt-20">
            <Card className="h-fit w-full max-w-4xl">
              <CardHeader>
                <CardTitle>Upload Text</CardTitle>
                <CardDescription>
                  Write markdown text that can be positioned on the editor
                  canvas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedProject ? (
                  <UploadTextWizard
                    projectId={selectedProject.id}
                    onUploadCompleted={() => {
                      showUploadNotice("Text upload finished");
                      setProjectPage("view");
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    default:
      return null;
  }
}
