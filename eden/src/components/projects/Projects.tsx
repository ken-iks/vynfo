import { useState } from "react";
import type { ProjectMetadata } from "../../gen/proto/v1/projects_pb";
import { ProjectView } from "./detail/ProjectView";
import { ProjectConfigDropDown } from "./detail/ProjectConfigDropdown";
import { SpacesList } from "./detail/SpacesList";
import { ProjectsList } from "./list/ProjectsList";
import { MediaHolder } from "../video/MediaHolder";
import { Button } from "../ui/button";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export type ProjectPage =
  | "list"
  | "view"
  | "uploadVideo"
  | "uploadImage"
  | "spaces";

export function Projects() {
  const [projectPage, setProjectPage] = useState<ProjectPage>("list");
  const [selectedProject, setSelectedProject] = useState<ProjectMetadata>();

  const openProject = (project: ProjectMetadata) => {
    setSelectedProject(project);
    setProjectPage("view");
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
          <div className="absolute top-2 right-8 z-10 flex items-center gap-2">
            <Button variant="outline" onClick={() => setProjectPage("spaces")}>
              Project Spaces
            </Button>
            <ProjectConfigDropDown handlePageSelection={setProjectPage} />
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
    case "spaces":
      return (
        <div className="relative h-full">
          <div className="absolute top-2 left-2 z-10">
            <Button variant="outline" onClick={() => setProjectPage("view")}>
              <ArrowLeftIcon className="size-4" />
              Back to Project
            </Button>
          </div>
          {selectedProject && <SpacesList project={selectedProject} />}
        </div>
      );
    default:
      return null;
  }
}
