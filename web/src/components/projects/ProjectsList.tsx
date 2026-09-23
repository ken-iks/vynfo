import type { ProjectMetadata } from "../../gen/proto/v1/projects_pb";
import { useBreadcrumbs } from "../Breadcrumbs";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ProjectRowActions } from "./ProjectRowActions";
import { ProjectTable } from "./ProjectTable";
import { useProjectsList } from "./hooks/useProjectsList";

interface ProjectsListProps {
  onSelect: (project: ProjectMetadata) => void;
}

export function ProjectsList({ onSelect }: ProjectsListProps) {
  const {
    addingMemberId,
    availableUsers,
    currentWorkspaceId,
    deletingProjectId,
    handleAddProjectUser,
    handleDeleteProject,
    handleProjectCreated,
    projects,
    userId,
  } = useProjectsList({ onSelect });

  useBreadcrumbs([{ label: "Projects" }]);

  return (
    <div className="px-12 pt-12">
      <div className="mb-2 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <CreateProjectDialog
            workspaceId={currentWorkspaceId}
            onCreated={handleProjectCreated}
          />
        </div>
      </div>
      <div className="space-y-6">
        <ProjectTable
          title=""
          projects={projects}
          onSelect={onSelect}
          rowActions={(project) => (
            <ProjectRowActions
              project={project}
              userId={userId}
              availableUsers={availableUsers}
              addingMemberId={addingMemberId}
              deletingProjectId={deletingProjectId}
              onAddProjectUser={handleAddProjectUser}
              onDeleteProject={handleDeleteProject}
            />
          )}
        />
      </div>
    </div>
  );
}
