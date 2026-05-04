import type { ProjectMetadata } from "../../gen/proto/v1/projects_pb";
import { SectionSubtitle } from "../shared/SectionSubtitle";
import { SectionTitle } from "../shared/SectionTitle";
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

  return (
    <div className="px-12 pt-12">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <SectionTitle>Projects</SectionTitle>
          <SectionSubtitle>
            {" "}
            Vynfo projects are the main video editing surface area. Collaborate
            with teammates and agents on your most ambitious work!{" "}
          </SectionSubtitle>
        </div>
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
