import { useState } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const ProjectForm = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-6">Configuração do Projeto</h2>
      <div className="space-y-6">
        <ProjectSelector
          selectedProjectId={selectedProjectId}
          onProjectSelect={setSelectedProjectId}
        />

        {selectedProjectId && (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="vesselName">Nome da Embarcação</Label>
              <Input id="vesselName" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <Input id="startDate" type="date" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="projectType">Tipo de Projeto</Label>
              <Input id="projectType" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="engineer">Responsável</Label>
              <Input id="engineer" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="captain">Comandante</Label>
              <Input id="captain" className="mt-1" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};