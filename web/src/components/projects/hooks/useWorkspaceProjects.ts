import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import { client } from "@/lib/client";
import { useEffect, useState } from "react";

export function useWorkspaceProjects() {
  const { currentWorkspaceId } = useWorkspaceContext();
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);

  useEffect(() => {
    if (!currentWorkspaceId) {
      setProjects([]);
      return;
    }

    let cancelled = false;
    const loadProjects = async () => {
      const { projects } = await client.listProjects({
        workspaceId: currentWorkspaceId,
      });
      if (!cancelled) setProjects(projects);
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  return projects;
}
