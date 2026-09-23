import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import { DataTable } from "../shared/DataTable";
import { formatTimestampDate } from "@/utils/timestamp-conversaions";
import { ProjectCreator } from "./ProjectCreator";

interface ProjectTableProps {
  title: string;
  projects: ProjectMetadata[];
  onSelect: (project: ProjectMetadata) => void;
  rowActions?: (project: ProjectMetadata) => ReactNode;
}

export function ProjectTable({
  title,
  projects,
  onSelect,
  rowActions,
}: ProjectTableProps) {
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
        if (!row.original.createdAt) return "-";
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
