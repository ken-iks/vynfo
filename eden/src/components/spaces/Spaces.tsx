import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Navigate, useNavigate, useParams } from "react-router";
import { spacesClient } from "@/lib/client";
import type { ProjectSpace } from "@/gen/proto/v1/spaces_pb";
import { AddUserDropdown } from "../shared/AddUserDropdown";
import { useBreadcrumbs } from "../Breadcrumbs";
import { DataTable } from "../shared/DataTable";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";
import { SpaceView } from "./SpaceView";
import { useSpaces } from "./hooks/useSpaces";
import { CreateSpaceDialogue } from "./CreateSpaceDialogue";

export function Spaces() {
  const navigate = useNavigate();
  const {
    addingMemberId,
    createOpen,
    creating,
    currentWorkspaceId,
    getAvailableUsers,
    handleAddUser,
    handleCreateOpenChange,
    handleCreateSpace,
    setSpaceName,
    spaceName,
    spaces,
  } = useSpaces();

  useBreadcrumbs([{ label: "Reviews" }]);

  const columns: ColumnDef<ProjectSpace>[] = [
    {
      accessorKey: "name",
      header: "Name",
      enableSorting: true,
    },
    {
      id: "users",
      accessorFn: (space) => space.users.map((user) => user.email).join(", "),
      header: "Members",
      cell: ({ row }) =>
        row.original.users.map((user) => user.email).join(", "),
      enableSorting: true,
    },
  ];

  return (
    <div className="px-12 pt-12">
      <div className="mb-2 flex items-center justify-end">
        <CreateSpaceDialogue
          creating={creating}
          disabled={!currentWorkspaceId}
          name={spaceName}
          onNameChange={setSpaceName}
          onOpenChange={handleCreateOpenChange}
          onSubmit={handleCreateSpace}
          open={createOpen}
        />
      </div>
      <DataTable<ProjectSpace>
        title=""
        data={spaces}
        columns={columns}
        rowActions={(space) => {
          const availableUsers = getAvailableUsers(space);
          return (
            <AddUserDropdown
              users={availableUsers}
              disabled={addingMemberId !== ""}
              isAddingUser={(user) =>
                addingMemberId === `${space.spaceId}:${user.userId}`
              }
              onSelectUser={(user) => handleAddUser(space, user)}
            />
          );
        }}
        onSelectRow={(space) => navigate(`/spaces/${space.spaceId}`)}
      />
    </div>
  );
}

export function SpaceRoute() {
  const { spaceId } = useParams();
  const { currentWorkspaceId } = useWorkspaceContext();
  const [space, setSpace] = useState<ProjectSpace>();

  useBreadcrumbs([
    { label: "Reviews", to: "/spaces" },
    { label: space?.name ?? "Review" },
  ]);

  useEffect(() => {
    if (!spaceId || !currentWorkspaceId) return;

    const loadSpace = async () => {
      const res = await spacesClient.listSpaces({
        workspaceId: currentWorkspaceId,
      });
      setSpace(res.spaces.find((candidate) => candidate.spaceId === spaceId));
    };

    void loadSpace();
  }, [currentWorkspaceId, spaceId]);

  if (!spaceId) return <Navigate to="/spaces" replace />;

  return (
    <div className="flex h-full min-h-0 justify-center px-12 pb-6 pt-10">
      <Card className="h-full min-h-[82vh] w-full max-w-5xl p-0">
        <CardHeader className="border-b">
          <CardDescription>
            {space ? `${space.users.length} members` : "Loading space..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <SpaceView spaceId={spaceId} />
        </CardContent>
      </Card>
    </div>
  );
}
