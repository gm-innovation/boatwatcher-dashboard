
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
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-4 mb-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-3 text-gray-800">Informações do Projeto</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="flex items-center space-x-2">
          <Ship className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Embarcação</p>
            <p className="text-sm font-medium text-gray-800">{projectInfo.vesselName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Data de Início</p>
            <p className="text-sm font-medium text-gray-800">{projectInfo.startDate}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Anchor className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Tipo de Projeto</p>
            <p className="text-sm font-medium text-gray-800">{projectInfo.projectType}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Engenheiro</p>
            <p className="text-sm font-medium text-gray-800">{projectInfo.engineer}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Empresa</p>
            <p className="text-sm font-medium text-gray-800">{projectInfo.company}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Comandante</p>
            <p className="text-sm font-medium text-gray-800">{projectInfo.captain}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
