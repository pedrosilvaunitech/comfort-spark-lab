import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Monitor, Tablet, LayoutDashboard, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type ScreenConfig, defaultScreenConfig, loadScreenConfig } from "@/lib/screen-config";

const FONT_OPTIONS = [
  { value: "", label: "Padrão do Sistema" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Lato', sans-serif", label: "Lato" },
  { value: "'Source Sans Pro', sans-serif", label: "Source Sans Pro" },
  { value: "'Nunito', sans-serif", label: "Nunito" },
  { value: "'Ubuntu', sans-serif", label: "Ubuntu" },
  { value: "monospace", label: "Monospace" },
];

function ColorField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "#000000"} className="flex-1 h-8 text-xs" />
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
      </div>
    </div>
  );
}

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
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configurações Gerais</CardTitle>
          <CardDescription>Logo, nome e favicon do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Nome do Sistema</Label>
            <Input value={config.systemName} onChange={(e) => update("systemName", e.target.value)} placeholder="Sistema de Senhas" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">URL do Logo (imagem)</Label>
            <Input value={config.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://exemplo.com/logo.png" className="h-8 text-sm" />
            {config.logoUrl && (
              <div className="mt-2 p-2 bg-muted rounded flex items-center justify-center">
                <img src={config.logoUrl} alt="Logo" className="max-h-16 object-contain" />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">URL do Favicon</Label>
            <Input value={config.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)} placeholder="https://exemplo.com/favicon.ico" className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="totem">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="totem" className="gap-1"><Tablet className="h-3 w-3" /> Totem</TabsTrigger>
          <TabsTrigger value="panel" className="gap-1"><Monitor className="h-3 w-3" /> Painel</TabsTrigger>
          <TabsTrigger value="counter" className="gap-1"><LayoutDashboard className="h-3 w-3" /> Guichê</TabsTrigger>
        </TabsList>

        {/* TOTEM */}
        <TabsContent value="totem">
          <Card>
            <CardHeader>
              <CardTitle>Tela do Totem</CardTitle>
              <CardDescription>Personalize completamente a aparência do totem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={config.totemTitle} onChange={(e) => update("totemTitle", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Subtítulo</Label>
                  <Input value={config.totemSubtitle} onChange={(e) => update("totemSubtitle", e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor de fundo" value={config.totemBgColor} onChange={(v) => update("totemBgColor", v)} placeholder="#1e3a5f" />
                <ColorField label="Cor do texto" value={config.totemTextColor} onChange={(v) => update("totemTextColor", v)} placeholder="#ffffff" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor do botão (fundo)" value={config.totemButtonBgColor} onChange={(v) => update("totemButtonBgColor", v)} placeholder="#ffffff" />
                <ColorField label="Cor do botão (texto)" value={config.totemButtonTextColor} onChange={(v) => update("totemButtonTextColor", v)} placeholder="#000000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Arredondamento do botão (px)</Label>
                  <Input type="number" value={config.totemButtonRadius} onChange={(e) => update("totemButtonRadius", e.target.value)} className="h-8 text-sm" min="0" max="50" />
                </div>
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.totemFontFamily} onValueChange={(v) => update("totemFontFamily", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Padrão" /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tamanho do logo (vh)</Label>
                  <Input type="number" value={config.totemLogoSize} onChange={(e) => update("totemLogoSize", e.target.value)} className="h-8 text-sm" min="3" max="20" />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <Label className="text-xs">Mostrar logo</Label>
                  <Switch checked={config.totemShowLogo} onCheckedChange={(v) => update("totemShowLogo", v)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PANEL */}
        <TabsContent value="panel">
          <Card>
            <CardHeader>
              <CardTitle>Tela do Painel</CardTitle>
              <CardDescription>Personalize completamente o painel de chamadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Título do Painel</Label>
                <Input value={config.panelTitle} onChange={(e) => update("panelTitle", e.target.value)} placeholder="Clínica Exemplo" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor de fundo" value={config.panelBgColor} onChange={(v) => update("panelBgColor", v)} placeholder="#1e3a5f" />
                <ColorField label="Cor do texto" value={config.panelTextColor} onChange={(v) => update("panelTextColor", v)} placeholder="#ffffff" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor da senha chamada" value={config.panelTicketColor} onChange={(v) => update("panelTicketColor", v)} placeholder="#facc15" />
                <ColorField label="Cor fundo cabeçalho" value={config.panelHeaderBgColor} onChange={(v) => update("panelHeaderBgColor", v)} placeholder="#000000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor fundo rodapé" value={config.panelFooterBgColor} onChange={(v) => update("panelFooterBgColor", v)} placeholder="#000000" />
                <ColorField label="Cor texto rodapé" value={config.panelFooterTextColor} onChange={(v) => update("panelFooterTextColor", v)} placeholder="#ffffff" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.panelFontFamily} onValueChange={(v) => update("panelFontFamily", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Padrão" /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tamanho do logo (vh)</Label>
                  <Input type="number" value={config.panelLogoSize} onChange={(e) => update("panelLogoSize", e.target.value)} className="h-8 text-sm" min="3" max="20" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mostrar logo no painel</Label>
                <Switch checked={config.panelShowLogo} onCheckedChange={(v) => update("panelShowLogo", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COUNTER */}
        <TabsContent value="counter">
          <Card>
            <CardHeader>
              <CardTitle>Tela do Guichê</CardTitle>
              <CardDescription>Personalize completamente a tela do operador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Título do Guichê</Label>
                <Input value={config.counterTitle} onChange={(e) => update("counterTitle", e.target.value)} placeholder="Painel do Guichê" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor de fundo" value={config.counterBgColor} onChange={(v) => update("counterBgColor", v)} placeholder="#ffffff" />
                <ColorField label="Cor do texto" value={config.counterTextColor} onChange={(v) => update("counterTextColor", v)} placeholder="#000000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor fundo cabeçalho" value={config.counterHeaderBgColor} onChange={(v) => update("counterHeaderBgColor", v)} placeholder="#ffffff" />
                <ColorField label="Cor texto cabeçalho" value={config.counterHeaderTextColor} onChange={(v) => update("counterHeaderTextColor", v)} placeholder="#000000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor do botão (fundo)" value={config.counterButtonBgColor} onChange={(v) => update("counterButtonBgColor", v)} placeholder="#2563eb" />
                <ColorField label="Cor do botão (texto)" value={config.counterButtonTextColor} onChange={(v) => update("counterButtonTextColor", v)} placeholder="#ffffff" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.counterFontFamily} onValueChange={(v) => update("counterFontFamily", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Padrão" /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <Label className="text-xs">Mostrar logo</Label>
                  <Switch checked={config.counterShowLogo} onCheckedChange={(v) => update("counterShowLogo", v)} />
                </div>
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
