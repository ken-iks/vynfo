import { useState } from "react";
import { useNavigate } from "react-router";
import { workspacesClient } from "@/lib/client";
import type { User } from "@/gen/proto/v1/users_pb";
import { useAuthContext } from "../providers/AuthProvider";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import { AddUserDropdown } from "../shared/AddUserDropdown";
import { SectionTitle } from "../shared/SectionTitle";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

function ProfileImage({
  src,
  displayName,
}: {
  src: string;
  displayName: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={`${displayName} profile`}
        className="size-20 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex size-20 items-center justify-center rounded-full bg-muted text-2xl font-medium text-muted-foreground">
      {displayName.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { appUser, userId, users } = useAuthContext();
  const {
    workspaces,
    currentWorkspaceId,
    loadingWorkspaces,
    selectWorkspace,
    refreshWorkspaces,
  } = useWorkspaceContext();
  const [addingWorkspaceUserId, setAddingWorkspaceUserId] = useState("");
  const displayName = appUser?.displayName || appUser?.email || "User";
  const availableUsers = users.filter((user) => user.userId !== userId);

  const handleSelectWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    navigate("/projects");
  };

  const handleAddWorkspaceUser = async (user: User) => {
    if (!currentWorkspaceId) return;

    setAddingWorkspaceUserId(user.userId);
    try {
      await workspacesClient.addWorkspaceUser({
        workspaceId: currentWorkspaceId,
        userId: user.userId,
      });
      await refreshWorkspaces();
    } catch (err) {
      console.error("failed to add user to workspace", err);
    } finally {
      setAddingWorkspaceUserId("");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-12 py-12">
      <SectionTitle>Settings</SectionTitle>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your Vynfo profile details</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <ProfileImage
            src={appUser?.signedDisplayPhotoPath ?? ""}
            displayName={displayName}
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{displayName}</p>
            {appUser?.email && (
              <p className="truncate text-sm text-muted-foreground">
                {appUser.email}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>
                Switch between workspaces you belong to
              </CardDescription>
            </div>
            <AddUserDropdown
              users={availableUsers}
              disabled={!currentWorkspaceId || addingWorkspaceUserId !== ""}
              isAddingUser={(user) => addingWorkspaceUserId === user.userId}
              onSelectUser={handleAddWorkspaceUser}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {loadingWorkspaces ? (
            <p className="text-sm text-muted-foreground">
              Loading workspaces...
            </p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workspaces found.
            </p>
          ) : (
            workspaces.map((workspace) => (
              <Button
                key={workspace.workspaceId}
                variant={
                  workspace.workspaceId === currentWorkspaceId
                    ? "default"
                    : "outline"
                }
                className="justify-start"
                onClick={() => handleSelectWorkspace(workspace.workspaceId)}
              >
                {workspace.name}
              </Button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
