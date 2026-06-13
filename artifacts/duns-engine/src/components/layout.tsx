import { Link, useLocation } from "wouter";
import { LayoutDashboard, List, PlusCircle, Settings, Building2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <Building2 className="text-primary-foreground w-5 h-5" />
              </div>
              <span className="font-serif font-semibold text-lg tracking-tight">DUNS Engine</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/dashboard"} tooltip="Dashboard">
                  <Link href="/dashboard" data-testid="link-nav-dashboard">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/cases"} tooltip="All Cases">
                  <Link href="/cases" data-testid="link-nav-cases">
                    <List className="w-4 h-4" />
                    <span>All Cases</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/cases/new"} tooltip="New Request">
                  <Link href="/cases/new" data-testid="link-nav-new-case">
                    <PlusCircle className="w-4 h-4" />
                    <span>New Request</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/50 flex items-center px-4 md:px-6 bg-card shrink-0 gap-4">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1" />
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors" data-testid="btn-settings">
              <Settings className="w-4 h-4" />
            </button>
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
