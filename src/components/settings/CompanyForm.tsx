import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { isElectron } from "@/lib/dataProvider";
import { createCompany, updateCompany } from "@/hooks/useDataProvider";
import { uploadFile, getPublicUrl } from "@/lib/storageProvider";
import { supabase } from "@/integrations/supabase/client";
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

  const handleLogoUpload = async (file: File, isDarkMode: boolean) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    if (isElectron()) {
      // In Electron, store as data URL
      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const { error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({
        title: `Erro ao fazer upload da logo ${isDarkMode ? 'dark' : 'light'}`,
        description: uploadError.message,
        variant: "destructive",
      });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('client-logos')
      .getPublicUrl(fileName);

    toast({
      title: "Logo atualizada",
      description: `A logo ${isDarkMode ? 'dark' : 'light'} do cliente foi atualizada com sucesso.`,
    });

    return publicUrl;
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

      let logoUrlLight = null;
      let logoUrlDark = null;
      
      const logoLightInput = document.querySelector<HTMLInputElement>('input[name="logo-light"]');
      const logoDarkInput = document.querySelector<HTMLInputElement>('input[name="logo-dark"]');

      if (logoLightInput?.files?.length) {
        logoUrlLight = await handleLogoUpload(logoLightInput.files[0], false);
      }

      if (logoDarkInput?.files?.length) {
        logoUrlDark = await handleLogoUpload(logoDarkInput.files[0], true);
      }

      const companyData = {
        name: companyName,
        project_managers: projectManagersArray,
        vessels: vesselsArray,
        ...(logoUrlLight && { logo_url_light: logoUrlLight }),
        ...(logoUrlDark && { logo_url_dark: logoUrlDark }),
      };

      if (selectedCompanyId && selectedCompanyId !== "new") {
        await updateCompany(selectedCompanyId, companyData);
        toast({
          title: "Empresa atualizada",
          description: "Os dados da empresa foram atualizados com sucesso.",
        });
      } else {
        await createCompany(companyData);
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
          <h2 className="text-xl font-semibold text-foreground">Cadastro de Empresa</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Logo da Empresa (Light Mode)</Label>
              <Input type="file" name="logo-light" accept="image/*" className="mt-2" />
              <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-white dark:bg-zinc-900 mt-2">
                {selectedCompanyId && selectedCompanyId !== "new" ? (
                  <img
                    src={companies?.find(c => c.id === selectedCompanyId)?.logo_url_light || ''}
                    alt="Logo da Empresa (Light)"
                    className="max-h-24 max-w-full object-contain"
                  />
                ) : (
                  <p className="text-muted-foreground">Nenhuma logo definida</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo da Empresa (Dark Mode)</Label>
              <Input type="file" name="logo-dark" accept="image/*" className="mt-2" />
              <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-zinc-900 dark:bg-white mt-2">
                {selectedCompanyId && selectedCompanyId !== "new" ? (
                  <img
                    src={companies?.find(c => c.id === selectedCompanyId)?.logo_url_dark || ''}
                    alt="Logo da Empresa (Dark)"
                    className="max-h-24 max-w-full object-contain"
                  />
                ) : (
                  <p className="text-muted-foreground">Nenhuma logo definida</p>
                )}
              </div>
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
              <TableHead>Data de Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies?.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
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
