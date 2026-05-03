import { useEffect, useState } from "react";
import { useAuthContext } from "../../providers/AuthProvider";
import { client } from "../../../lib/client";
import type { ProjectMetadata } from "../../../gen/proto/v1/projects_pb";
import type { User } from "../../../gen/proto/v1/users_pb";
import { Table } from "../../shared/Table";
import { SectionTitle } from "../../shared/SectionTitle";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { formatTimestampDate } from "@/lib/utils";
import { AddUserDropdown } from "../../shared/AddUserDropdown";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

interface ProjectsListProps {
  onSelect: (project: ProjectMetadata) => void;
}

export function ProjectsList({ onSelect }: ProjectsListProps) {
  const { userId, users } = useAuthContext();
  const [userCreatedProjects, setUserCreatedProjects] = useState<
    ProjectMetadata[]
  >([]);
  const [userMemberProjects, setUserMemberProjects] = useState<
    ProjectMetadata[]
  >([]);
  const [addingMemberId, setAddingMemberId] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState("");

  const fetchProjects = async () => {
    const projects = await client.listProjects({});
    setUserCreatedProjects(projects.userCreatedProjects);
    setUserMemberProjects(projects.userMemberProjects);
    return projects.userCreatedProjects;
  };

  useEffect(() => {
    fetchProjects();
  }, [userId]);

  const handleProjectCreated = async (projectId: string) => {
    const projects = await fetchProjects();
    const created = projects.find((p) => p.id === projectId);
    if (created) onSelect(created);
  };

  const availableUsers = users.filter((user) => user.userId !== userId);

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
      await fetchProjects();
    } catch (err) {
      console.error("failed to delete project", err);
      throw err;
    } finally {
      setDeletingProjectId("");
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Projects</SectionTitle>
        <div className="flex items-center gap-2">
          <CreateProjectDialog onCreated={handleProjectCreated} />
        </div>
      </div>
      <div className="space-y-6">
        <ProjectTable
          title="Projects You Created"
          projects={userCreatedProjects}
          onSelect={onSelect}
          rowActions={(project) => (
            <div className="flex items-center justify-end gap-2">
              <AddUserDropdown
                users={availableUsers}
                disabled={addingMemberId !== "" || deletingProjectId !== ""}
                isAddingUser={(user) =>
                  addingMemberId === `${project.id}:${user.userId}`
                }
                onSelectUser={(user) => handleAddProjectUser(project, user)}
              />
              <DeleteProjectDialog
                project={project}
                disabled={addingMemberId !== "" || deletingProjectId !== ""}
                deleting={deletingProjectId === project.id}
                onConfirm={() => handleDeleteProject(project)}
              />
            </div>
          )}
        />
        <ProjectTable
          title="Projects You're Part Of"
          projects={userMemberProjects}
          onSelect={onSelect}
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
  return (
    <Table<ProjectMetadata>
      title={title}
      data={projects}
      columns={[
        { key: "name", header: "Project Title" },
        { key: "description", header: "Project Descriptions" },
        {
          key: "createdAt",
          header: "Created At",
          render: (_value, row) => {
            if (!row.createdAt) return "—";
            return formatTimestampDate(row.createdAt);
          },
        },
      ]}
      rowActions={rowActions}
      onSelectRow={(row) => onSelect(row)}
    />
  );
}
