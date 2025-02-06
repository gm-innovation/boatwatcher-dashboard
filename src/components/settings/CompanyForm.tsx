import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useCompanies } from "@/hooks/useSupabase";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CompanyForm = () => {
  const { toast } = useToast();
  const { data: companies, refetch } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [projectManagers, setProjectManagers] = useState("");
  const [vessels, setVessels] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedCompanyId && selectedCompanyId !== "new") {
      const company = companies?.find(c => c.id === selectedCompanyId);
      if (company) {
        setCompanyName(company.name);
        setProjectManagers(company.project_managers?.join('\n') || '');
        setVessels(company.vessels?.join('\n') || '');
      }
    } else {
      setCompanyName("");
      setProjectManagers("");
      setVessels("");
    }
  }, [selectedCompanyId, companies]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast({
          title: "Erro ao fazer upload da logo",
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      toast({
        title: "Logo atualizada",
        description: "A logo do cliente foi atualizada com sucesso.",
      });

      return publicUrl;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const projectManagersArray = projectManagers
        .split('\n')
        .map(pm => pm.trim())
        .filter(pm => pm !== '');

      const vesselsArray = vessels
        .split('\n')
        .map(v => v.trim())
        .filter(v => v !== '');

      let logoUrl = null;
      const logoInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (logoInput?.files?.length) {
        logoUrl = await handleLogoUpload(logoInput as unknown as React.ChangeEvent<HTMLInputElement>);
      }

      if (selectedCompanyId && selectedCompanyId !== "new") {
        const { error } = await supabase
          .from('companies')
          .update({
            name: companyName,
            project_managers: projectManagersArray,
            vessels: vesselsArray,
            ...(logoUrl && { logo_url: logoUrl }),
          })
          .eq('id', selectedCompanyId);

        if (error) throw error;

        toast({
          title: "Empresa atualizada",
          description: "Os dados da empresa foram atualizados com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert({
            name: companyName,
            logo_url: logoUrl,
            project_managers: projectManagersArray,
            vessels: vesselsArray,
          });

        if (error) throw error;

        toast({
          title: "Empresa cadastrada",
          description: "A empresa foi cadastrada com sucesso.",
        });
      }

      setCompanyName("");
      setProjectManagers("");
      setVessels("");
      setSelectedCompanyId(null);
      refetch();
    } catch (error: any) {
      toast({
        title: selectedCompanyId ? "Erro ao atualizar empresa" : "Erro ao cadastrar empresa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Cadastro de Empresa</h2>
          <Select value={selectedCompanyId || "new"} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma empresa para editar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Nova empresa</SelectItem>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>Logo da Empresa</Label>
            <Input
              type="file"
              accept="image/*"
              className="mt-2"
            />
            <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-white dark:bg-zinc-900 mt-2">
              {selectedCompanyId && selectedCompanyId !== "new" ? (
                <img
                  src={companies?.find(c => c.id === selectedCompanyId)?.logo_url || ''}
                  alt="Logo da Empresa"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <p className="text-muted-foreground">Nenhuma logo definida</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="companyName">Nome da Empresa (Armador)</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-2"
              required
            />
          </div>

          <div>
            <Label htmlFor="projectManagers">Gerentes de Projeto (Responsáveis)</Label>
            <Textarea
              id="projectManagers"
              value={projectManagers}
              onChange={(e) => setProjectManagers(e.target.value)}
              className="mt-2"
              placeholder="Digite os nomes dos gerentes de projeto, um por linha"
            />
          </div>

          <div>
            <Label htmlFor="vessels">Embarcações</Label>
            <Textarea
              id="vessels"
              value={vessels}
              onChange={(e) => setVessels(e.target.value)}
              className="mt-2"
              placeholder="Digite os nomes das embarcações, uma por linha"
            />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : selectedCompanyId && selectedCompanyId !== "new" ? "Atualizar Empresa" : "Cadastrar Empresa"}
          </Button>
        </form>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Empresas Cadastradas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Empresa</TableHead>
              <TableHead>Horário de Entrada</TableHead>
              <TableHead>Quantidade de Trabalhadores</TableHead>
              <TableHead>Data de Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies?.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>
                  {company.entry_time ? format(new Date(company.entry_time), 'HH:mm') : '-'}
                </TableCell>
                <TableCell>{company.workers_count || 0}</TableCell>
                <TableCell>
                  {company.created_at ? format(new Date(company.created_at), 'dd/MM/yyyy') : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
