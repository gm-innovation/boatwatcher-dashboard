import { Header } from "@/components/Header";
import { ProjectProvider, useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const MainLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { isFullscreenMode, toggleFullscreen, isHeaderCollapsed } = useProject();

  return (
    <div className="min-h-screen">
      {!isFullscreenMode && <Header />}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 transition-all duration-300 ${isFullscreenMode ? 'pt-4' : isHeaderCollapsed ? 'pt-14' : 'pt-40'}`}>
        {children}
      </main>
      {isFullscreenMode && (
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 right-4 z-50 gap-2"
          onClick={toggleFullscreen}
        >
          <Menu className="h-4 w-4" />
          Exibir Menu
        </Button>
      )}
    </div>
  );
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProjectProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </ProjectProvider>
  );
};
