
import { useState, useEffect } from "react";
import { ProjectInfo } from "@/components/ProjectInfo";
import { SummaryCards } from "@/components/SummaryCards";
import { WorkersList } from "@/components/WorkersList";
import { CompaniesList } from "@/components/CompaniesList";
import { ProjectSelector } from "@/components/ProjectSelector";

const Index = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Load last selected project from localStorage
  useEffect(() => {
    const lastSelectedProject = localStorage.getItem('lastSelectedProject');
    if (lastSelectedProject) {
      setSelectedProjectId(lastSelectedProject);
    }
  }, []);

  // Debug log for selectedProjectId changes
  useEffect(() => {
    console.log("Index - selectedProjectId:", selectedProjectId);
  }, [selectedProjectId]);

  // Save selected project to localStorage
  const handleProjectSelect = (projectId: string) => {
    console.log("Index - handleProjectSelect called with:", projectId);
    setSelectedProjectId(projectId);
    localStorage.setItem('lastSelectedProject', projectId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 sticky top-[72px] bg-background z-10">
          <ProjectSelector 
            selectedProjectId={selectedProjectId}
            onProjectSelect={handleProjectSelect}
          />
          <ProjectInfo key={selectedProjectId} projectId={selectedProjectId} />
          <SummaryCards projectId={selectedProjectId} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <WorkersList projectId={selectedProjectId} />
            </div>
            <CompaniesList projectId={selectedProjectId} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
