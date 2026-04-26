import { useEffect, useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { client } from "../../../lib/client";
import type { ProjectMetadata } from "../../../gen/proto/v1/projects_pb";
import type { ProjectSpace } from "../../../gen/proto/v1/spaces_pb";
import { Table } from "../../shared/Table";
import { SectionTitle } from "../../shared/SectionTitle";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { SpacesDropdown } from "./SpacesDropdown";
import { formatTimestampDate } from "@/lib/utils";

interface ProjectsListProps {
  onSelect: (project: ProjectMetadata) => void;
  onSelectSpace: (space: ProjectSpace) => void;
}

export function ProjectsList({ onSelect, onSelectSpace }: ProjectsListProps) {
  const userId = useAuth();
  const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);

  const fetchProjects = async () => {
    const projects = await client.listProjects({ userId });
    setProjectList(projects.projects);
    return projects.projects;
  };

  useEffect(() => {
    fetchProjects();
  }, [userId]);

  const handleProjectCreated = async (projectId: string) => {
    const projects = await fetchProjects();
    const created = projects.find((p) => p.id === projectId);
    if (created) onSelect(created);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Projects</SectionTitle>
        <div className="flex items-center gap-2">
          <SpacesDropdown onSelectSpace={onSelectSpace} />
          <CreateProjectDialog onCreated={handleProjectCreated} />
        </div>
      </div>
      <Table<ProjectMetadata>
        title=""
        data={projectList}
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
        onSelectRow={(row) => onSelect(row)}
      />
    </div>
  );
}
