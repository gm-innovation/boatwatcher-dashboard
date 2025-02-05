
import { format } from 'date-fns';

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
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6 animate-fade-up">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Lista de Empresas</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nome da Empresa</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Horário de Entrada</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-800">{company.name}</td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {format(company.entryTime, 'HH:mm')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
