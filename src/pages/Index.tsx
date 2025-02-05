
import { Header } from "@/components/Header";
import { ProjectInfo } from "@/components/ProjectInfo";
import { SummaryCards } from "@/components/SummaryCards";
import { WorkersList } from "@/components/WorkersList";
import { CompaniesList } from "@/components/CompaniesList";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 sticky top-0 bg-gray-50 z-10">
          <ProjectInfo />
          <SummaryCards />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WorkersList />
            <CompaniesList />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

