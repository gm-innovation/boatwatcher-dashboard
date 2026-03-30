import { Dashboard } from "@/components/dashboard/Dashboard";
import { useProject } from "@/contexts/ProjectContext";

const Index = () => {
  const { selectedProjectId } = useProject();

  return (
    <div className="space-y-6">
      <Dashboard projectId={selectedProjectId} />
    </div>
  );
};

export default Index;
