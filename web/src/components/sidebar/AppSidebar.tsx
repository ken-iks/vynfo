import { useLocation, useNavigate } from "react-router";
import { useAuthContext } from "../providers/AuthProvider";
import { useWorkspaceContext } from "../providers/WorkspaceProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "../ui/sidebar";
import { UserConfigSheet } from "./UserConfigSheet";

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
    title: "Reviews",
    icon: "/icons/spaces-icon.svg",
    path: "/spaces",
    disabled: false,
  },
  {
    title: "Files",
    icon: "/icons/vfs-icon.svg",
    path: "/vfs",
    disabled: false,
  },
  {
    title: "Ask Murch",
    icon: "/icons/agent-icon.svg",
    path: "/murch",
    disabled: false,
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
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <SidebarGroupLabel className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            Vynfo
          </SidebarGroupLabel>
          <SidebarTrigger className="shrink-0" />
        </div>
        <UserConfigSheet
          displayPictureUrl={appUser?.signedDisplayPhotoPath}
          displayName={displayName}
          workspaceName={currentWorkspace?.name}
        />
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                navigate("/settings");
              }}
            >
              <img
                src="/icons/settings-icon.svg"
                alt=""
                className="size-4 shrink-0"
              />
              <span> Settings </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
