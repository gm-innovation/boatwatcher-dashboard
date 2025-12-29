
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const SystemSettings = () => {
  const { toast } = useToast();

  const handleLogoUpload = (themeMode: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')  // Changed from 'client-logos' to 'company-logos'
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
        .from('company-logos')  // Changed from 'client-logos' to 'company-logos'
        .getPublicUrl(fileName);

      toast({
        title: "Logo atualizada",
        description: `A logo foi atualizada com sucesso para o modo ${themeMode === 'light' ? 'claro' : 'escuro'}.`,
      });

      localStorage.setItem(`company_${themeMode}`, publicUrl);
    }
  };

  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-6">Configuração do Sistema</h2>
      <div className="space-y-6">
        <div>
          <Label htmlFor="logoLight">Logo (Modo Claro)</Label>
          <Input
            id="logoLight"
            type="file"
            accept="image/*"
            onChange={handleLogoUpload('light')}
            className="mt-2"
          />
          <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-white mt-2">
            {localStorage.getItem('company_light') ? (
              <img
                src={localStorage.getItem('company_light') || ''}
                alt="Logo Modo Claro"
                className="max-h-24 max-w-full object-contain"
              />
            ) : (
              <p className="text-muted-foreground">Nenhuma logo definida</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="logoDark">Logo (Modo Escuro)</Label>
          <Input
            id="logoDark"
            type="file"
            accept="image/*"
            onChange={handleLogoUpload('dark')}
            className="mt-2"
          />
          <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-zinc-900 mt-2">
            {localStorage.getItem('company_dark') ? (
              <img
                src={localStorage.getItem('company_dark') || ''}
                alt="Logo Modo Escuro"
                className="max-h-24 max-w-full object-contain"
              />
            ) : (
              <p className="text-muted-foreground">Nenhuma logo definida</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
