
import { Header } from "@/components/Header";
import { useState } from "react";

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24">
        {children}
      </main>
    </div>
  );
};
