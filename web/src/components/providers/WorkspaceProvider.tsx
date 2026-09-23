import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { workspacesClient } from "@/lib/client";
import type { Workspace } from "@/gen/proto/v1/workspaces_pb";

const selectedWorkspaceStorageKey = "vynfo_selected_workspace_id";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | undefined;
  currentWorkspaceId: string;
  loadingWorkspaces: boolean;
  selectWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<Workspace[]>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await workspacesClient.listWorkspaces({});
      setWorkspaces(res.workspaces);
      setSelectedWorkspaceId((current) => {
        if (
          res.workspaces.some((workspace) => workspace.workspaceId === current)
        ) {
          return current;
        }

        const storedWorkspaceId = window.localStorage.getItem(
          selectedWorkspaceStorageKey,
        );
        if (
          storedWorkspaceId &&
          res.workspaces.some(
            (workspace) => workspace.workspaceId === storedWorkspaceId,
          )
        ) {
          return storedWorkspaceId;
        }

        return res.workspaces[0]?.workspaceId ?? "";
      });
      return res.workspaces;
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    window.localStorage.setItem(
      selectedWorkspaceStorageKey,
      selectedWorkspaceId,
    );
  }, [selectedWorkspaceId]);

  const currentWorkspace = workspaces.find(
    (workspace) => workspace.workspaceId === selectedWorkspaceId,
  );

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      currentWorkspaceId: currentWorkspace?.workspaceId ?? "",
      loadingWorkspaces,
      selectWorkspace: setSelectedWorkspaceId,
      refreshWorkspaces,
    }),
    [workspaces, currentWorkspace, loadingWorkspaces, refreshWorkspaces],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error(
      "useWorkspaceContext must be used within WorkspaceProvider",
    );
  }
  return context;
}
