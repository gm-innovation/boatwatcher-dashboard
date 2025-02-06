import { Search } from 'lucide-react';
import { useState } from 'react';
import { useCompanies } from '@/hooks/useSupabase';
import { CompaniesTable } from './companies/CompaniesTable';
import { EditCompanyDialog } from './companies/EditCompanyDialog';

export const CompaniesList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: companies = [], isLoading, refetch } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    setIsDialogOpen(true);
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border flex flex-col col-span-1">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Empresas</h2>
            <span className="px-2 py-1 bg-muted rounded-md text-sm text-muted-foreground">
              {companies.length}
            </span>
          </div>
          <div className="relative">
            <Search className="h-5 w-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <CompaniesTable 
          companies={filteredCompanies} 
          onEditCompany={handleEditCompany} 
        />
      )}

      {selectedCompany && (
        <EditCompanyDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          company={selectedCompany}
          onSave={refetch}
        />
      )}
    </div>
  );
};