import { Outlet } from "react-router";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./shared/ThemeToggle";
import { Button } from "./ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";

export function AppLayout({ onSignOut }: { onSignOut: () => void }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button size="sm" variant="outline" onClick={onSignOut}>
                Sign out
              </Button>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
