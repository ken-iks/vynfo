import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ProjectSpace } from "@/gen/proto/v1/spaces_pb";
import type { User } from "@/gen/proto/v1/users_pb";
import { spacesClient } from "@/lib/client";
import { useWorkspaceContext } from "../../providers/WorkspaceProvider";

export function useSpaces() {
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

  return {
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
  };
}
