import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import type { ProjectMetadata } from "../../gen/proto/v1/projects_pb";
import { ProjectView } from "./ProjectView";
import { ProjectsList } from "./ProjectsList";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import { client } from "@/lib/client";

export function Projects() {
  const navigate = useNavigate();
  const { currentWorkspaceId } = useWorkspaceContext();

  useEffect(() => {
    navigate("/projects", { replace: true });
  }, [currentWorkspaceId]);

  return (
    <ProjectsList
      onSelect={(project) => {
        navigate(`/projects/${project.id}`);
      }}
    />
  );
}

export function ProjectRoute() {
  const { projectId } = useParams();
  const { currentWorkspaceId } = useWorkspaceContext();
  const [project, setProject] = useState<ProjectMetadata>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId || !currentWorkspaceId) {
      setProject(undefined);
      setLoaded(false);
      return;
    }

    const loadProject = async () => {
      setLoaded(false);
      setProject(undefined);
      const res = await client.listProjects({
        workspaceId: currentWorkspaceId,
      });
      setProject(res.projects.find((candidate) => candidate.id === projectId));
      setLoaded(true);
    };

    void loadProject();
  }, [currentWorkspaceId, projectId]);

  if (!projectId) return <Navigate to="/projects" replace />;

  return (
    <div className="relative h-full">
      {project ? (
        <ProjectView project={project} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {loaded ? "Project not found" : "Loading project..."}
        </div>
      )}
    </div>
  );
}
