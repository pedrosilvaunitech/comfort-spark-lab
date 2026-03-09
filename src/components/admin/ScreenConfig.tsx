import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Monitor, Tablet, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type ScreenConfig, defaultScreenConfig, loadScreenConfig } from "@/lib/screen-config";

export function ScreenConfigPanel() {
  const [config, setConfig] = useState<ScreenConfig>(defaultScreenConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadScreenConfig().then(setConfig);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("system_config").upsert(
        { key: "screen_config", value: config as any },
        { onConflict: "key" }
      );
      toast.success("Configuração das telas salva!");
      // Update favicon dynamically
      if (config.faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) link.href = config.faviconUrl;
      }
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof ScreenConfig, value: any) => setConfig({ ...config, [key]: value });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Logo, nome e favicon do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome do Sistema</Label>
            <Input value={config.systemName} onChange={(e) => update("systemName", e.target.value)} placeholder="Sistema de Senhas" />
          </div>
          <div>
            <Label>URL do Logo (imagem)</Label>
            <Input value={config.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://exemplo.com/logo.png" />
            {config.logoUrl && (
              <div className="mt-2 p-2 bg-muted rounded flex items-center justify-center">
                <img src={config.logoUrl} alt="Logo" className="max-h-16 object-contain" />
              </div>
            )}
          </div>
          <div>
            <Label>URL do Favicon</Label>
            <Input value={config.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)} placeholder="https://exemplo.com/favicon.ico" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="totem">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="totem" className="gap-1"><Tablet className="h-3 w-3" /> Totem</TabsTrigger>
          <TabsTrigger value="panel" className="gap-1"><Monitor className="h-3 w-3" /> Painel</TabsTrigger>
          <TabsTrigger value="counter" className="gap-1"><LayoutDashboard className="h-3 w-3" /> Guichê</TabsTrigger>
        </TabsList>

        <TabsContent value="totem">
          <Card>
            <CardHeader>
              <CardTitle>Tela do Totem</CardTitle>
              <CardDescription>Personalize a aparência do totem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={config.totemTitle} onChange={(e) => update("totemTitle", e.target.value)} />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={config.totemSubtitle} onChange={(e) => update("totemSubtitle", e.target.value)} />
              </div>
              <div>
                <Label>Cor de fundo (vazio = padrão do tema)</Label>
                <div className="flex gap-2">
                  <Input value={config.totemBgColor} onChange={(e) => update("totemBgColor", e.target.value)} placeholder="#1e3a5f" className="flex-1" />
                  <input type="color" value={config.totemBgColor || "#1e40af"} onChange={(e) => update("totemBgColor", e.target.value)} className="h-10 w-10 rounded border cursor-pointer" />
                </div>
              </div>
              <div>
                <Label>Cor do texto (vazio = padrão do tema)</Label>
                <div className="flex gap-2">
                  <Input value={config.totemTextColor} onChange={(e) => update("totemTextColor", e.target.value)} placeholder="#ffffff" className="flex-1" />
                  <input type="color" value={config.totemTextColor || "#ffffff"} onChange={(e) => update("totemTextColor", e.target.value)} className="h-10 w-10 rounded border cursor-pointer" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="panel">
          <Card>
            <CardHeader>
              <CardTitle>Tela do Painel</CardTitle>
              <CardDescription>Personalize a aparência do painel de chamadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título do Painel (aparece no topo, vazio = sem título)</Label>
                <Input value={config.panelTitle} onChange={(e) => update("panelTitle", e.target.value)} placeholder="Clínica Exemplo" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mostrar logo no painel</Label>
                <Switch checked={config.panelShowLogo} onCheckedChange={(v) => update("panelShowLogo", v)} />
              </div>
              <div>
                <Label>Cor de fundo (vazio = padrão do tema)</Label>
                <div className="flex gap-2">
                  <Input value={config.panelBgColor} onChange={(e) => update("panelBgColor", e.target.value)} placeholder="#1e3a5f" className="flex-1" />
                  <input type="color" value={config.panelBgColor || "#1e40af"} onChange={(e) => update("panelBgColor", e.target.value)} className="h-10 w-10 rounded border cursor-pointer" />
                </div>
              </div>
              <div>
                <Label>Cor do texto (vazio = padrão do tema)</Label>
                <div className="flex gap-2">
                  <Input value={config.panelTextColor} onChange={(e) => update("panelTextColor", e.target.value)} placeholder="#ffffff" className="flex-1" />
                  <input type="color" value={config.panelTextColor || "#ffffff"} onChange={(e) => update("panelTextColor", e.target.value)} className="h-10 w-10 rounded border cursor-pointer" />
                </div>
              </div>
              <div>
                <Label>Cor do número da senha chamada (vazio = padrão)</Label>
                <div className="flex gap-2">
                  <Input value={config.panelTicketColor} onChange={(e) => update("panelTicketColor", e.target.value)} placeholder="#facc15" className="flex-1" />
                  <input type="color" value={config.panelTicketColor || "#facc15"} onChange={(e) => update("panelTicketColor", e.target.value)} className="h-10 w-10 rounded border cursor-pointer" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counter">
          <Card>
            <CardHeader>
              <CardTitle>Tela do Guichê</CardTitle>
              <CardDescription>Personalize a aparência da tela do operador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título do Guichê</Label>
                <Input value={config.counterTitle} onChange={(e) => update("counterTitle", e.target.value)} placeholder="Painel do Guichê" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mostrar logo no guichê</Label>
                <Switch checked={config.counterShowLogo} onCheckedChange={(v) => update("counterShowLogo", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Configuração das Telas"}
      </Button>
    </div>
  );
}
