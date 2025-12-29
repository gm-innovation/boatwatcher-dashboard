import { Header } from "@/components/Header";
import { ProjectProvider } from "@/contexts/ProjectContext";

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProjectProvider>
      <div className="min-h-screen">
        <Header />
        <main className="pt-28 px-4 sm:px-6 lg:px-8 pb-8">
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
};
