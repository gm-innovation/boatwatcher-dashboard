import { useState } from 'react';
import { useCompanies } from '@/hooks/useSupabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Edit2, Trash2, Building2, Image, Upload } from 'lucide-react';
import type { Company } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/theme-provider';

interface ClientFormProps {
  client?: Company | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ClientForm = ({ client, onSuccess, onCancel }: ClientFormProps) => {
  const [name, setName] = useState(client?.name || '');
  const [cnpj, setCnpj] = useState(client?.cnpj || '');
  const [contactEmail, setContactEmail] = useState(client?.contact_email || '');
  const [logoUrlLight, setLogoUrlLight] = useState(client?.logo_url_light || '');
  const [logoUrlDark, setLogoUrlDark] = useState(client?.logo_url_dark || '');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (client) {
        const { error } = await supabase
          .from('companies')
          .update({ 
            name, 
            cnpj, 
            contact_email: contactEmail,
            logo_url_light: logoUrlLight || null,
            logo_url_dark: logoUrlDark || null
          })
          .eq('id', client.id);
        if (error) throw error;
        toast({ title: 'Cliente atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert({ 
            name, 
            cnpj, 
            contact_email: contactEmail,
            logo_url_light: logoUrlLight || null,
            logo_url_dark: logoUrlDark || null
          });
        if (error) throw error;
        toast({ title: 'Cliente cadastrado com sucesso' });
      }
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Cliente *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">Email API</Label>
        <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logoUrlLight">URL Logo (Tema Claro)</Label>
        <Input id="logoUrlLight" value={logoUrlLight} onChange={(e) => setLogoUrlLight(e.target.value)} placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logoUrlDark">URL Logo (Tema Escuro)</Label>
        <Input id="logoUrlDark" value={logoUrlDark} onChange={(e) => setLogoUrlDark(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : client ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
};

export const ClientsManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Company | null>(null);
  const { data: companies = [], isLoading } = useCompanies();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const handleDelete = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja remover ${company.name}?`)) return;
    
    const { error } = await supabase.from('companies').delete().eq('id', company.id);
    if (error) {
      toast({ title: 'Erro ao remover cliente', variant: 'destructive' });
    } else {
      toast({ title: 'Cliente removido' });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    }
  };

  const getClientLogo = (company: Company) => {
    return theme === 'dark' ? company.logo_url_dark : company.logo_url_light;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clientes (Armadores)</h2>
          <p className="text-sm text-muted-foreground">{companies.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Image className="h-4 w-4" />
            Alterar Logo da Aplicação
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClient(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
              </DialogHeader>
              <ClientForm 
                client={editingClient} 
                onSuccess={() => {
                  setIsDialogOpen(false);
                  setEditingClient(null);
                }}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingClient(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : companies.length > 0 ? (
        <ScrollArea className="h-[500px] border rounded-lg">
          <table className="w-full">
            <thead className="sticky top-0 bg-card border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Logo</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email API</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ambiente</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b hover:bg-muted/50">
                  <td className="p-4">
                    <Avatar className="h-10 w-10">
                      {getClientLogo(company) ? (
                        <AvatarImage src={getClientLogo(company)!} alt={company.name} />
                      ) : (
                        <AvatarFallback>
                          <Building2 className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </td>
                  <td className="p-4 font-medium">{company.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{company.contact_email || '-'}</td>
                  <td className="p-4 text-center">
                    <Badge variant="outline">Produção</Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge className="bg-green-500/10 text-green-500">Ativo</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingClient(company);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(company)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum cliente cadastrado</p>
          <p className="text-sm">Adicione o primeiro cliente</p>
        </div>
      )}
    </div>
  );
};
