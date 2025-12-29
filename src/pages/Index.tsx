import { Dashboard } from "@/components/dashboard/Dashboard";
import { useProject } from "@/contexts/ProjectContext";

const Index = () => {
  const { selectedProjectId } = useProject();

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard projectId={selectedProjectId} />
      </main>
    </div>
  );
};

export default Index;
