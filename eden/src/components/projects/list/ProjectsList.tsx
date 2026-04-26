import { useEffect, useState } from "react";
import { useAuthSwitcher } from "../../providers/AuthProvider";
import { client } from "../../../lib/client";
import type { ProjectMetadata } from "../../../gen/proto/v1/projects_pb";
import type { User } from "../../../gen/proto/v1/users_pb";
import { Table } from "../../shared/Table";
import { SectionTitle } from "../../shared/SectionTitle";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { formatTimestampDate } from "@/lib/utils";
import { AddUserDropdown } from "../../shared/AddUserDropdown";

interface ProjectsListProps {
  onSelect: (project: ProjectMetadata) => void;
}

export function ProjectsList({ onSelect }: ProjectsListProps) {
  const { userId, users } = useAuthSwitcher();
  const [userCreatedProjects, setUserCreatedProjects] = useState<
    ProjectMetadata[]
  >([]);
  const [userMemberProjects, setUserMemberProjects] = useState<
    ProjectMetadata[]
  >([]);
  const [addingMemberId, setAddingMemberId] = useState("");

  const fetchProjects = async () => {
    const projects = await client.listProjects({ userId });
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
            <AddUserDropdown
              users={availableUsers}
              disabled={addingMemberId !== ""}
              isAddingUser={(user) =>
                addingMemberId === `${project.id}:${user.userId}`
              }
              onSelectUser={(user) => handleAddProjectUser(project, user)}
            />
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
