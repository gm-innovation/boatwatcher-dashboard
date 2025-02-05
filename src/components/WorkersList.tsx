
import { Search } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const workers = [
  {
    id: 1,
    name: "João Silva",
    company: "TechMarine",
    role: "Engenheiro Mecânico",
    arrivalTime: "08:30",
    photo: "https://i.pravatar.cc/150?img=1"
  },
  {
    id: 2,
    name: "Maria Santos",
    company: "NavalTech",
    role: "Técnica de Segurança",
    arrivalTime: "09:15",
    photo: "https://i.pravatar.cc/150?img=2"
  },
  // Add more workers as needed
];

export const WorkersList = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6 mb-6 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Lista de Trabalhadores</h2>
        <div className="relative">
          <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Foto</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nome</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Empresa</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Função</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Horário de Chegada</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker) => (
                <tr key={worker.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <img
                      src={worker.photo}
                      alt={worker.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-800">{worker.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{worker.company}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{worker.role}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{worker.arrivalTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
};
