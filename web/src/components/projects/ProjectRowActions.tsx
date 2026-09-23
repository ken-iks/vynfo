import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import type { User } from "@/gen/proto/v1/users_pb";
import { AddUserDropdown } from "../shared/AddUserDropdown";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

interface ProjectRowActionsProps {
  project: ProjectMetadata;
  userId: string;
  availableUsers: User[];
  addingMemberId: string;
  deletingProjectId: string;
  onAddProjectUser: (project: ProjectMetadata, user: User) => void;
  onDeleteProject: (project: ProjectMetadata) => Promise<void>;
}

export function ProjectRowActions({
  project,
  userId,
  availableUsers,
  addingMemberId,
  deletingProjectId,
  onAddProjectUser,
  onDeleteProject,
}: ProjectRowActionsProps) {
  const disabled =
    project.createdBy?.userId !== userId ||
    addingMemberId !== "" ||
    deletingProjectId !== "";

  return (
    <div className="flex items-center justify-end gap-2">
      <AddUserDropdown
        users={availableUsers}
        disabled={disabled}
        isAddingUser={(user) =>
          addingMemberId === `${project.id}:${user.userId}`
        }
        onSelectUser={(user) => onAddProjectUser(project, user)}
      />
      <DeleteProjectDialog
        project={project}
        disabled={disabled}
        deleting={deletingProjectId === project.id}
        onConfirm={() => onDeleteProject(project)}
      />
    </div>
  );
}
