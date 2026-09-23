import { useState } from "react";
import { Outlet } from "react-router";
import { AppSidebar } from "./sidebar/AppSidebar";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";
import { HeaderSlotProvider } from "./HeaderSlot";
import { BreadcrumbProvider, HeaderBreadcrumbs } from "./Breadcrumbs";

export function AppLayout() {
  const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <BreadcrumbProvider>
            <HeaderSlotProvider value={headerEl}>
              <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
                <HeaderBreadcrumbs />
                <div
                  ref={setHeaderEl}
                  className="flex min-w-0 flex-1 items-center justify-end gap-2"
                />
              </header>
              <main className="min-h-0 flex-1 overflow-auto">
                <Outlet />
              </main>
            </HeaderSlotProvider>
          </BreadcrumbProvider>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
