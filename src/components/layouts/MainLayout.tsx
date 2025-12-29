import { Header } from "@/components/Header";
import { ProjectProvider } from "@/contexts/ProjectContext";

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProjectProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24">
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
};
