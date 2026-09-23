import { useEffect, useState } from "react";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import type { User } from "@/gen/proto/v1/users_pb";
import { client } from "@/lib/client";
import { useAuthContext } from "../../providers/AuthProvider";
import { useWorkspaceContext } from "../../providers/WorkspaceProvider";

interface UseProjectsListArgs {
  onSelect: (project: ProjectMetadata) => void;
}

export function useProjectsList({ onSelect }: UseProjectsListArgs) {
  const { userId } = useAuthContext();
  const { currentWorkspace, currentWorkspaceId } = useWorkspaceContext();
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [addingMemberId, setAddingMemberId] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState("");

  const fetchProjects = async (workspaceId: string) => {
    const res = await client.listProjects({ workspaceId });
    setProjects(res.projects);
    return res.projects;
  };

  useEffect(() => {
    const loadWorkspaceProjects = async () => {
      if (!currentWorkspaceId) {
        setProjects([]);
        return;
      }
      await fetchProjects(currentWorkspaceId);
    };
    loadWorkspaceProjects();
  }, [currentWorkspaceId, userId]);

  const handleProjectCreated = async (projectId: string) => {
    if (!currentWorkspaceId) return;
    const projects = await fetchProjects(currentWorkspaceId);
    const created = projects.find((p) => p.id === projectId);
    if (created) onSelect(created);
  };

  const availableUsers =
    currentWorkspace?.users.filter((user) => user.userId !== userId) ?? [];

  const handleAddProjectUser = async (project: ProjectMetadata, user: User) => {
    setAddingMemberId(`${project.id}:${user.userId}`);
    try {
      await client.addProjectUser({
        projectId: project.id,
        userId: user.userId,
      });
    } catch (err) {
      console.error("failed to add user to project", err);
    } finally {
      setAddingMemberId("");
    }
  };

  const handleDeleteProject = async (project: ProjectMetadata) => {
    setDeletingProjectId(project.id);
    try {
      await client.deleteProject({
        projectId: project.id,
      });
      if (currentWorkspaceId) {
        await fetchProjects(currentWorkspaceId);
      }
    } catch (err) {
      console.error("failed to delete project", err);
      throw err;
    } finally {
      setDeletingProjectId("");
    }
  };

  return {
    addingMemberId,
    availableUsers,
    currentWorkspaceId,
    deletingProjectId,
    handleAddProjectUser,
    handleDeleteProject,
    handleProjectCreated,
    projects,
    userId,
  };
}
