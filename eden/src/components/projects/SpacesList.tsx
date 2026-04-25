import { useEffect, useState } from "react";
import { spacesClient } from "@/lib/client";
import type { ProjectSpace } from "@/gen/proto/v1/spaces_pb";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import { Button } from "../ui/button";
import { Table } from "../shared/Table";
import { SectionTitle } from "../shared/SectionTitle";
import { useAuth } from "../providers/AuthProvider";

interface SpacesListProps {
  project: ProjectMetadata;
}

export function SpacesList({ project }: SpacesListProps) {
  const userId = useAuth();
  const [spaces, setSpaces] = useState<ProjectSpace[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchSpaces = async () => {
    const res = await spacesClient.listSpaces({ projectId: project.id });
    setSpaces(res.spaces);
  };

  useEffect(() => {
    fetchSpaces();
  }, [project.id]);

  const handleCreateSpace = async () => {
    setCreating(true);
    try {
      await spacesClient.createSpace({
        userId,
        projectId: project.id,
      });
      await fetchSpaces();
    } catch (err) {
      console.error("failed to create space", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-12 pt-12">
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Spaces in {project.name}</SectionTitle>
        <Button onClick={handleCreateSpace} disabled={creating}>
          {creating ? "Creating..." : "Create Space"}
        </Button>
      </div>
      <Table<ProjectSpace>
        title=""
        data={spaces}
        columns={[
          { key: "spaceId", header: "Space ID" },
          {
            key: "adminUserId",
            header: "Admin",
          },
          {
            key: "users",
            header: "Members",
            render: (_value, row) => row.users.length,
          },
        ]}
        onSelectRow={() => {}}
      />
    </div>
  );
}
