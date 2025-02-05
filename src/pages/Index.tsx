
import { useState } from "react";
import { Header } from "@/components/Header";
import { ProjectInfo } from "@/components/ProjectInfo";
import { ProjectSelector } from "@/components/ProjectSelector";
import { SummaryCards } from "@/components/SummaryCards";
import { WorkersList } from "@/components/WorkersList";
import { CompaniesList } from "@/components/CompaniesList";

const Index = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-[72px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 sticky top-[72px] bg-background z-10">
          <div className="flex justify-end mb-4">
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              onProjectSelect={setSelectedProjectId}
            />
          </div>
          <ProjectInfo projectId={selectedProjectId} />
          <SummaryCards />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-6">
            <WorkersList className="col-span-2" />
            <CompaniesList />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

