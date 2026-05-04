import { useLocation, useNavigate } from "react-router";
import { useAuthContext } from "./providers/AuthProvider";
import { useWorkspaceContext } from "./providers/WorkspaceProvider";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

type SidebarRoute = {
  title: string;
  icon: string;
  path: string;
  disabled: boolean;
};

const sidebarRoutes: SidebarRoute[] = [
  {
    title: "Projects",
    icon: "/icons/projects-icon.svg",
    path: "/projects",
    disabled: false,
  },
  {
    title: "Spaces",
    icon: "/icons/spaces-icon.svg",
    path: "/spaces",
    disabled: false,
  },
  {
    title: "VFS",
    icon: "/icons/vfs-icon.svg",
    path: "/vfs",
    disabled: false,
  },
  {
    title: "Vynfo Agent",
    icon: "/icons/agent-icon.svg",
    path: "/agent",
    disabled: true,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { appUser } = useAuthContext();
  const { currentWorkspace } = useWorkspaceContext();
  const displayName = appUser?.displayName || appUser?.email || "User";

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarGroupLabel>Vynfo</SidebarGroupLabel>
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:hidden">
          {appUser?.signedDisplayPhotoPath ? (
            <img
              src={appUser.signedDisplayPhotoPath}
              alt={`${displayName} profile`}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {currentWorkspace && (
              <p className="truncate text-xs text-muted-foreground">
                {currentWorkspace.name}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={isActive("/settings") ? "default" : "outline"}
          className="mx-2 justify-start group-data-[collapsible=icon]:hidden"
          onClick={() => navigate("/settings")}
        >
          Settings
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarRoutes.map((route) => (
                <SidebarMenuItem key={route.path}>
                  <SidebarMenuButton
                    disabled={route.disabled}
                    isActive={!route.disabled && isActive(route.path)}
                    tooltip={route.title}
                    onClick={() => {
                      if (!route.disabled) navigate(route.path);
                    }}
                    className={
                      route.disabled
                        ? "opacity-45 grayscale hover:bg-transparent"
                        : ""
                    }
                  >
                    <img src={route.icon} alt="" className="size-4 shrink-0" />
                    <span>{route.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
