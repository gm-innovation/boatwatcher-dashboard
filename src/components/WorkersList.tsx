
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

export const WorkersList = ({ className = "" }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 flex flex-col ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
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
      </div>

      <div className="px-6 border-b border-gray-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[100px] text-center py-3 text-sm font-medium text-gray-500">Foto</th>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-gray-500">Nome</th>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-gray-500">Empresa</th>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-gray-500">Função</th>
              <th className="w-[150px] text-center py-3 text-sm font-medium text-gray-500">Entrada</th>
            </tr>
          </thead>
        </table>
      </div>

      <ScrollArea className="flex-1 h-[400px]">
        <div className="px-6">
          <table className="w-full">
            <tbody>
              {filteredWorkers.map((worker) => (
                <tr key={worker.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="w-[100px] py-3 text-center">
                    <div className="flex justify-center">
                      <img
                        src={worker.photo}
                        alt={worker.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    </div>
                  </td>
                  <td className="w-[200px] py-3 text-sm text-gray-800 text-center">{worker.name}</td>
                  <td className="w-[200px] py-3 text-sm text-gray-600 text-center">{worker.company}</td>
                  <td className="w-[200px] py-3 text-sm text-gray-600 text-center">{worker.role}</td>
                  <td className="w-[150px] py-3 text-sm text-gray-600 text-center">{worker.arrivalTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
};
