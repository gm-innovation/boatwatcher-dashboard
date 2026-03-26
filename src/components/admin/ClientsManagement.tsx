import { useState, useRef } from 'react';
import { useClients } from '@/hooks/useSupabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Building2, Upload, Loader2 } from 'lucide-react';
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
  const [status, setStatus] = useState(client?.status || 'active');
  const [logoUrlLight, setLogoUrlLight] = useState(client?.logo_url_light || '');
  const [logoUrlDark, setLogoUrlDark] = useState(client?.logo_url_dark || '');
  const [cnpj, setCnpj] = useState(client?.cnpj || '');
  const [contactEmail, setContactEmail] = useState(client?.contact_email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingLight, setUploadingLight] = useState(false);
  const [uploadingDark, setUploadingDark] = useState(false);
  
  const lightLogoRef = useRef<HTMLInputElement>(null);
  const darkLogoRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleLogoUpload = async (file: File, type: 'light' | 'dark') => {
    const setUploading = type === 'light' ? setUploadingLight : setUploadingDark;
    const setLogoUrl = type === 'light' ? setLogoUrlLight : setLogoUrlDark;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      toast({ title: 'Logo enviado com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar logo', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = { 
        name, 
        status,
        type: 'client' as const,
        cnpj: cnpj || null,
        contact_email: contactEmail || null,
        logo_url_light: logoUrlLight || null,
        logo_url_dark: logoUrlDark || null
      };

      if (client) {
        const { error } = await supabase
          .from('companies')
          .update(payload)
          .eq('id', client.id);
        if (error) throw error;
        toast({ title: 'Cliente atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Cliente cadastrado com sucesso' });
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1: Nome e Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Cliente *</Label>
          <Input 
            id="name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nome do cliente"
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Logos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Logo Normal</Label>
          <input
            type="file"
            ref={lightLogoRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file, 'light');
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-auto gap-2"
            onClick={() => lightLogoRef.current?.click()}
            disabled={uploadingLight}
          >
            {uploadingLight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar Logo
          </Button>
          <p className="text-xs text-muted-foreground">Logo usada no sistema</p>
          {logoUrlLight && (
            <div className="mt-2">
              <img src={logoUrlLight} alt="Logo Normal" className="h-12 object-contain rounded border p-1" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Logo Rotacionada (Etiquetas)</Label>
          <input
            type="file"
            ref={darkLogoRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file, 'dark');
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-auto gap-2"
            onClick={() => darkLogoRef.current?.click()}
            disabled={uploadingDark}
          >
            {uploadingDark ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar Logo
          </Button>
          <p className="text-xs text-muted-foreground">Logo já rotacionada para etiquetas</p>
          {logoUrlDark && (
            <div className="mt-2">
              <img src={logoUrlDark} alt="Logo Rotacionada" className="h-12 object-contain rounded border p-1" />
            </div>
          )}
        </div>
      </div>

      {/* Row 3: CNPJ e Email de Contato */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input 
            id="cnpj" 
            value={cnpj} 
            onChange={(e) => setCnpj(e.target.value)} 
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email de Contato</Label>
          <Input 
            id="contactEmail" 
            type="email"
            value={contactEmail} 
            onChange={(e) => setContactEmail(e.target.value)} 
            placeholder="contato@empresa.com"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : client ? 'Atualizar Cliente' : 'Criar Cliente'}
        </Button>
      </div>
    </form>
  );
};

export const ClientsManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Company | null>(null);
  const { data: companies = [], isLoading } = useClients();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const handleDelete = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja remover ${company.name}?`)) return;
    
    const { error } = await supabase.from('companies').delete().eq('id', company.id);
    if (error) {
      toast({ title: 'Erro ao remover cliente', variant: 'destructive' });
    } else {
      toast({ title: 'Cliente removido' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  };

  const getClientLogo = (company: Company) => {
    return theme === 'dark' ? company.logo_url_dark : company.logo_url_light;
  };

  const getStatusBadge = (status: string | null) => {
    if (status === 'inactive') {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Ativo</Badge>;
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Gerenciar Clientes</h2>
          <p className="text-sm text-muted-foreground">{companies.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            Alterar Logo da Aplicação
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClient(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
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
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">CNPJ</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Contato</th>
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
                  <td className="p-4 text-sm text-muted-foreground">{company.cnpj || '-'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{company.contact_email || '-'}</td>
                  <td className="p-4 text-center">
                    {getStatusBadge(company.status)}
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
