import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthContext } from "../../providers/AuthProvider";
import { useWorkspaceContext } from "../../providers/WorkspaceProvider";
import { client } from "../../../lib/client";
import type { ProjectMetadata } from "../../../gen/proto/v1/projects_pb";
import type { User } from "../../../gen/proto/v1/users_pb";
import { DataTable } from "../../shared/DataTable";
import { SectionTitle } from "../../shared/SectionTitle";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { AddUserDropdown } from "../../shared/AddUserDropdown";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { formatTimestampDate } from "@/utils/timestamp-conversaions";

interface ProjectsListProps {
  onSelect: (project: ProjectMetadata) => void;
}

export function ProjectsList({ onSelect }: ProjectsListProps) {
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

  return (
    <div className="px-12 pt-12">
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Projects</SectionTitle>
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
            <div className="flex items-center justify-end gap-2">
              <AddUserDropdown
                users={availableUsers}
                disabled={
                  project.createdBy?.userId !== userId ||
                  addingMemberId !== "" ||
                  deletingProjectId !== ""
                }
                isAddingUser={(user) =>
                  addingMemberId === `${project.id}:${user.userId}`
                }
                onSelectUser={(user) => handleAddProjectUser(project, user)}
              />
              <DeleteProjectDialog
                project={project}
                disabled={
                  project.createdBy?.userId !== userId ||
                  addingMemberId !== "" ||
                  deletingProjectId !== ""
                }
                deleting={deletingProjectId === project.id}
                onConfirm={() => handleDeleteProject(project)}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}

function DeleteProjectDialog({
  project,
  disabled,
  deleting,
  onConfirm,
}: {
  project: ProjectMetadata;
  disabled: boolean;
  deleting: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            This will permanently delete {project.name} and all of its media,
            commits, branches, and spaces.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={handleConfirm}
          >
            {deleting ? "Deleting..." : "Delete Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectTable({
  title,
  projects,
  onSelect,
  rowActions,
}: {
  title: string;
  projects: ProjectMetadata[];
  onSelect: (project: ProjectMetadata) => void;
  rowActions?: (project: ProjectMetadata) => React.ReactNode;
}) {
  const columns: ColumnDef<ProjectMetadata>[] = [
    {
      accessorKey: "name",
      header: "Project Title",
      enableSorting: true,
    },
    {
      accessorKey: "description",
      header: "Project Description",
      enableSorting: true,
    },
    {
      id: "createdBy",
      accessorFn: (project) =>
        project.createdBy?.displayName || project.createdBy?.email || "",
      header: "Created By",
      cell: ({ row }) => <ProjectCreator user={row.original.createdBy} />,
      enableSorting: true,
    },
    {
      id: "createdAt",
      accessorFn: (project) =>
        project.createdAt ? formatTimestampDate(project.createdAt) : "",
      header: "Created At",
      cell: ({ row }) => {
        if (!row.original.createdAt) return "—";
        return formatTimestampDate(row.original.createdAt);
      },
      enableSorting: true,
    },
  ];

  return (
    <DataTable<ProjectMetadata>
      title={title}
      data={projects}
      columns={columns}
      rowActions={rowActions}
      onSelectRow={(row) => onSelect(row)}
    />
  );
}

function ProjectCreator({ user }: { user: User | undefined }) {
  const displayName = user?.displayName || user?.email || "Unknown";
  const fallback = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        {user?.signedDisplayPhotoPath && (
          <AvatarImage src={user.signedDisplayPhotoPath} alt={displayName} />
        )}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <span className="truncate">{displayName}</span>
    </div>
  );
}
