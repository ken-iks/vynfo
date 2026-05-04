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
  {
    title: "Vynfo Reviews",
    icon: "/icons/review-icon.svg",
    path: "/reviews",
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
