
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const companies = [
  {
    id: 1,
    name: "TechMarine",
    entryTime: new Date('2024-03-15T08:30:00'),
  },
  {
    id: 2,
    name: "NavalTech",
    entryTime: new Date('2024-03-15T09:15:00'),
  },
  // Add more companies as needed
];

export const CompaniesList = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Lista de Empresas</h2>
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
              <th className="text-left py-3 text-sm font-medium text-gray-500">Nome da Empresa</th>
              <th className="text-left py-3 text-sm font-medium text-gray-500">Horário de Entrada</th>
            </tr>
          </thead>
        </table>
      </div>

      <ScrollArea className="flex-1 h-[400px]">
        <div className="px-6">
          <table className="w-full">
            <tbody>
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 text-sm text-gray-800">{company.name}</td>
                  <td className="py-3 text-sm text-gray-600">
                    {format(company.entryTime, 'HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
};
