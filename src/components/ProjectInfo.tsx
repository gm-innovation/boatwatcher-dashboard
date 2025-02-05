
import { Ship, Calendar, User, Building2, Anchor } from 'lucide-react';

export const ProjectInfo = () => {
  const projectInfo = {
    vesselName: "MV Ocean Explorer",
    startDate: "2024-03-15",
    projectType: "Docagem",
    engineer: "Eng. João Silva",
    company: "Marítima Internacional",
    captain: "Cap. Carlos Santos"
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6 mb-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Informações do Projeto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex items-center space-x-3">
          <Ship className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Embarcação</p>
            <p className="font-medium text-gray-800">{projectInfo.vesselName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Data de Início</p>
            <p className="font-medium text-gray-800">{projectInfo.startDate}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Anchor className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Tipo de Projeto</p>
            <p className="font-medium text-gray-800">{projectInfo.projectType}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Engenheiro Responsável</p>
            <p className="font-medium text-gray-800">{projectInfo.engineer}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Building2 className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Empresa</p>
            <p className="font-medium text-gray-800">{projectInfo.company}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Comandante</p>
            <p className="font-medium text-gray-800">{projectInfo.captain}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
