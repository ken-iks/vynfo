import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { spacesClient } from "@/lib/client";
import type { ProjectSpace } from "@/gen/proto/v1/spaces_pb";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import type { User } from "@/gen/proto/v1/users_pb";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Table } from "../../shared/Table";
import { SectionTitle } from "../../shared/SectionTitle";
import { useWorkspaceContext } from "../../providers/WorkspaceProvider";
import { AddUserDropdown } from "../../shared/AddUserDropdown";

interface SpacesListProps {
  project: ProjectMetadata;
  onSelectSpace: (space: ProjectSpace) => void;
}

export function SpacesList({ project, onSelectSpace }: SpacesListProps) {
  const { currentWorkspace } = useWorkspaceContext();
  const [spaces, setSpaces] = useState<ProjectSpace[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState("");

  const fetchSpaces = async () => {
    const res = await spacesClient.listSpaces({
      workspaceId: project.workspaceId,
    });
    setSpaces(res.spaces);
  };

  useEffect(() => {
    fetchSpaces();
  }, [project.workspaceId]);

  const resetCreateForm = () => {
    setSpaceName("");
    setCreating(false);
  };

  const handleCreateOpenChange = (next: boolean) => {
    if (!next) resetCreateForm();
    setCreateOpen(next);
  };

  const handleCreateSpace = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = spaceName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await spacesClient.createSpace({
        workspaceId: project.workspaceId,
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

  return (
    <div className="px-12 pt-12">
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Spaces in {project.name}</SectionTitle>
        <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={creating}>Create Space</Button>
          </DialogTrigger>
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
                  onChange={(e) => setSpaceName(e.target.value)}
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
                <Button type="submit" disabled={creating || !spaceName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table<ProjectSpace>
        title=""
        data={spaces}
        columns={[
          { key: "name", header: "Name" },
          {
            key: "users",
            header: "Members",
            render: (_value, row) =>
              row.users.map((user) => user.email).join(", "),
          },
        ]}
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
        onSelectRow={onSelectSpace}
      />
    </div>
  );
}
