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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [logoUrlRotated, setLogoUrlRotated] = useState((client as any)?.logo_url_rotated || '');
  const [cnpj, setCnpj] = useState(client?.cnpj || '');
  const [contactEmail, setContactEmail] = useState(client?.contact_email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingLight, setUploadingLight] = useState(false);
  const [uploadingDark, setUploadingDark] = useState(false);
  const [uploadingRotated, setUploadingRotated] = useState(false);
  
  const lightLogoRef = useRef<HTMLInputElement>(null);
  const darkLogoRef = useRef<HTMLInputElement>(null);
  const rotatedLogoRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleLogoUpload = async (file: File, type: 'light' | 'dark' | 'rotated') => {
    const setUploading = type === 'light' ? setUploadingLight : type === 'dark' ? setUploadingDark : setUploadingRotated;
    const setLogoUrl = type === 'light' ? setLogoUrlLight : type === 'dark' ? setLogoUrlDark : setLogoUrlRotated;
    
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
        logo_url_dark: logoUrlDark || null,
        logo_url_rotated: logoUrlRotated || null
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

  const LogoUploadBlock = ({ label, description, logoUrl, uploading, inputRef, type }: {
    label: string;
    description: string;
    logoUrl: string;
    uploading: boolean;
    inputRef: React.RefObject<HTMLInputElement>;
    type: 'light' | 'dark' | 'rotated';
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLogoUpload(file, type);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Enviar Logo
      </Button>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="min-h-[60px] flex items-center justify-center rounded border border-dashed border-border bg-muted/30">
        {logoUrl ? (
          <img src={logoUrl} alt={label} className="h-12 max-w-full object-contain p-1" />
        ) : (
          <span className="text-xs text-muted-foreground/50">Sem logo</span>
        )}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="grid grid-cols-3 gap-4">
        <LogoUploadBlock
          label="Logo Normal"
          description="Logo usada no modo claro"
          logoUrl={logoUrlLight}
          uploading={uploadingLight}
          inputRef={lightLogoRef}
          type="light"
        />
        <LogoUploadBlock
          label="Logo Dark Mode"
          description="Logo usada no modo escuro"
          logoUrl={logoUrlDark}
          uploading={uploadingDark}
          inputRef={darkLogoRef}
          type="dark"
        />
        <LogoUploadBlock
          label="Logo Rotacionada"
          description="Logo já rotacionada para etiquetas"
          logoUrl={logoUrlRotated}
          uploading={uploadingRotated}
          inputRef={rotatedLogoRef}
          type="rotated"
        />
      </div>

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
  const [searchTerm, setSearchTerm] = useState('');
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
          <h2 className="text-base font-semibold">Gerenciar Clientes</h2>
          <p className="text-xs text-muted-foreground">{companies.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Alterar Logo da Aplicação
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingClient(null)}>
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
        <TooltipProvider>
          <ScrollArea className="h-[500px] border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-xs py-2 px-3 w-[100px]">Logo</TableHead>
                  <TableHead className="text-xs py-2 px-3">Nome</TableHead>
                  <TableHead className="text-xs py-2 px-3">CNPJ</TableHead>
                  <TableHead className="text-xs py-2 px-3">Contato</TableHead>
                  <TableHead className="text-xs py-2 px-3 text-center w-[90px]">Status</TableHead>
                  <TableHead className="text-xs py-2 px-3 text-center w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="py-2 px-3 align-middle">
                      <div className="h-8 w-16 flex items-center justify-center">
                        {getClientLogo(company) ? (
                          <img src={getClientLogo(company)!} alt={company.name} className="h-8 w-16 object-contain" />
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center rounded bg-muted">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm font-medium align-middle whitespace-nowrap">{company.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm text-muted-foreground align-middle whitespace-nowrap">{company.cnpj || '-'}</TableCell>
                    <TableCell className="py-2 px-3 text-sm text-muted-foreground align-middle whitespace-nowrap">{company.contact_email || '-'}</TableCell>
                    <TableCell className="py-2 px-3 text-center align-middle">
                      {getStatusBadge(company.status)}
                    </TableCell>
                    <TableCell className="py-2 px-3 align-middle">
                      <div className="flex justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingClient(company);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(company)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TooltipProvider>
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
