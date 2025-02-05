
import { Header } from "@/components/Header";
import { ProjectInfo } from "@/components/ProjectInfo";
import { SummaryCards } from "@/components/SummaryCards";
import { WorkersList } from "@/components/WorkersList";
import { CompaniesList } from "@/components/CompaniesList";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProjectInfo />
        <SummaryCards />
        <WorkersList />
        <CompaniesList />
      </main>
    </div>
  );
};

export default Index;
