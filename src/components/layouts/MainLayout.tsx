import { Header } from "@/components/Header";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProjectProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <Header />
            <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-8">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
};
