import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Navigate, useNavigate, useParams } from "react-router";
import { spacesClient } from "@/lib/client";
import type { ProjectSpace } from "@/gen/proto/v1/spaces_pb";
import type { User } from "@/gen/proto/v1/users_pb";
import { AddUserDropdown } from "../shared/AddUserDropdown";
import { SectionTitle } from "../shared/SectionTitle";
import { DataTable } from "../shared/DataTable";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SpaceView } from "./SpaceView";

export function Spaces() {
  const navigate = useNavigate();
  const { currentWorkspace, currentWorkspaceId } = useWorkspaceContext();
  const [spaces, setSpaces] = useState<ProjectSpace[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState("");

  const fetchSpaces = useCallback(async () => {
    if (!currentWorkspaceId) {
      setSpaces([]);
      return;
    }

    const res = await spacesClient.listSpaces({
      workspaceId: currentWorkspaceId,
    });
    setSpaces(res.spaces);
  }, [currentWorkspaceId]);

  useEffect(() => {
    void fetchSpaces();
  }, [fetchSpaces]);

  const resetCreateForm = () => {
    setSpaceName("");
    setCreating(false);
  };

  const handleCreateOpenChange = (next: boolean) => {
    if (!next) resetCreateForm();
    setCreateOpen(next);
  };

  const handleCreateSpace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = spaceName.trim();
    if (!name || !currentWorkspaceId) return;

    setCreating(true);
    try {
      await spacesClient.createSpace({
        workspaceId: currentWorkspaceId,
        name,
      });
      setCreateOpen(false);
      resetCreateForm();
      await fetchSpaces();
    } catch (err) {
      console.error("failed to create space", err);
      setCreating(false);
    }
  };

  const getAvailableUsers = (space: ProjectSpace) =>
    currentWorkspace?.users.filter(
      (user) =>
        !space.users.some((spaceUser) => spaceUser.userId === user.userId),
    ) ?? [];

  const handleAddUser = async (space: ProjectSpace, user: User) => {
    setAddingMemberId(`${space.spaceId}:${user.userId}`);
    try {
      await spacesClient.addSpaceUser({
        spaceId: space.spaceId,
        userId: user.userId,
      });
      await fetchSpaces();
    } catch (err) {
      console.error("failed to add user to space", err);
    } finally {
      setAddingMemberId("");
    }
  };
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
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Spaces</SectionTitle>
        <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
          <Button
            disabled={creating || !currentWorkspaceId}
            onClick={() => setCreateOpen(true)}
          >
            Create Space
          </Button>
          <DialogContent>
            <form onSubmit={handleCreateSpace} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>New Space</DialogTitle>
                <DialogDescription>
                  Give this collaboration space a name.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1">
                <Label htmlFor="space-name">Name</Label>
                <Input
                  id="space-name"
                  value={spaceName}
                  onChange={(event) => setSpaceName(event.target.value)}
                  placeholder="Design review"
                  autoFocus
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCreateOpenChange(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    creating || !spaceName.trim() || !currentWorkspaceId
                  }
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
  const navigate = useNavigate();
  const { currentWorkspaceId } = useWorkspaceContext();
  const [space, setSpace] = useState<ProjectSpace>();

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{space?.name ?? "Space"}</CardTitle>
              <CardDescription>
                {space ? `${space.users.length} members` : "Loading space..."}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate("/spaces")}>
              Back to Spaces
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <SpaceView spaceId={spaceId} />
        </CardContent>
      </Card>
    </div>
  );
}
