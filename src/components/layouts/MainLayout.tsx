
import { Header } from "@/components/Header";
import { useState } from "react";

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        selectedProjectId={selectedProjectId}
        onProjectSelect={setSelectedProjectId}
      />
      <main className="pt-24">
        {children}
      </main>
    </div>
  );
};
