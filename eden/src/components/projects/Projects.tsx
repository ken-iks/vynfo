import { useState } from "react";
import type { ProjectMetadata } from "../../gen/proto/v1/projects_pb";
import type { ProjectSpace } from "../../gen/proto/v1/spaces_pb";
import { ProjectView } from "./detail/ProjectView";
import { ProjectConfigDropDown } from "./detail/ProjectConfigDropdown";
import { SpacesList } from "./detail/SpacesList";
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
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { SpaceView } from "../spaces/SpaceView";

export type ProjectPage =
  | "list"
  | "view"
  | "uploadVideo"
  | "uploadImage"
  | "uploadText"
  | "spaces"
  | "space";

type SpaceReturnPage = "list" | "spaces";

export function Projects() {
  const [projectPage, setProjectPage] = useState<ProjectPage>("list");
  const [selectedProject, setSelectedProject] = useState<ProjectMetadata>();
  const [selectedSpace, setSelectedSpace] = useState<ProjectSpace>();
  const [spaceReturnPage, setSpaceReturnPage] =
    useState<SpaceReturnPage>("list");

  const openProject = (project: ProjectMetadata) => {
    setSelectedProject(project);
    setProjectPage("view");
  };

  const openSpace = (space: ProjectSpace, returnPage: SpaceReturnPage) => {
    setSelectedSpace(space);
    setSpaceReturnPage(returnPage);
    setProjectPage("space");
  };

  const handleBackFromSpace = () => {
    setProjectPage(spaceReturnPage);
  };

  switch (projectPage) {
    case "list":
      return <ProjectsList onSelect={openProject} />;
    case "view":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("list")}>
              <ArrowLeftIcon className="size-4" />
              Back to Projects
            </Button>
          </div>
          <div className="absolute top-2 right-8 z-10 flex flex-col items-stretch gap-2">
            <ProjectConfigDropDown handlePageSelection={setProjectPage} />
            <Button variant="outline" onClick={() => setProjectPage("spaces")}>
              Project Spaces
            </Button>
          </div>
          {selectedProject && <ProjectView project={selectedProject} />}
        </div>
      );
    case "uploadVideo":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          {selectedProject ? (
            <MediaHolder projectId={selectedProject.id} />
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
                    onUploadCompleted={() => setProjectPage("view")}
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
                    onUploadCompleted={() => setProjectPage("view")}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    case "spaces":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          {selectedProject && (
            <SpacesList
              project={selectedProject}
              onSelectSpace={(space) => openSpace(space, "spaces")}
            />
          )}
        </div>
      );
    case "space":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={handleBackFromSpace}>
              <ArrowLeftIcon className="size-4" />
              {spaceReturnPage === "spaces"
                ? "Back to Project Spaces"
                : "Back to Projects"}
            </Button>
          </div>
          <div className="flex h-full min-h-0 justify-center px-12 pb-6 pt-14">
            <Card className="h-full min-h-[82vh] w-full max-w-5xl p-0">
              {selectedSpace && (
                <>
                  <CardHeader className="border-b">
                    <CardTitle>{selectedSpace.name}</CardTitle>
                    <CardDescription>
                      {selectedSpace.users.length} members
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                    <SpaceView spaceId={selectedSpace.spaceId} />
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </div>
      );
    default:
      return null;
  }
}
