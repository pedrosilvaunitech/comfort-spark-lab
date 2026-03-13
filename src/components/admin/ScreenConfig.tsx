import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Monitor, Tablet, LayoutDashboard, Settings2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type ScreenConfig, defaultScreenConfig, loadScreenConfig } from "@/lib/screen-config";

const FONT_OPTIONS = [
  { value: "default", label: "Padrão do Sistema" },
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

// Default visual colors to show in placeholder/color picker when field is empty
const PLACEHOLDER_COLORS: Record<string, string> = {
  totemBgColor: "#1e3a5f",
  totemTextColor: "#ffffff",
  totemButtonBgColor: "#ffffff",
  totemButtonTextColor: "#1e3a5f",
  panelBgColor: "#1e3a5f",
  panelTextColor: "#ffffff",
  panelTicketColor: "#facc15",
  panelHeaderBgColor: "#0f172a",
  panelFooterBgColor: "#000000",
  panelFooterTextColor: "#ffffff",
  counterBgColor: "#ffffff",
  counterTextColor: "#1e293b",
  counterHeaderBgColor: "#ffffff",
  counterHeaderTextColor: "#1e293b",
  counterButtonBgColor: "#2563eb",
  counterButtonTextColor: "#ffffff",
};

function ColorField({ label, value, onChange, fieldKey }: { label: string; value: string; onChange: (v: string) => void; fieldKey?: string }) {
  const placeholder = fieldKey ? PLACEHOLDER_COLORS[fieldKey] || "#000000" : "#000000";
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-8 text-xs"
        />
        <input
          type="color"
          value={value || placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 rounded border cursor-pointer"
        />
      </div>
      {!value && (
        <p className="text-[10px] text-muted-foreground mt-0.5">Padrão: {placeholder}</p>
      )}
    </div>
  );
}

export function ScreenConfigPanel() {
  const [config, setConfig] = useState<ScreenConfig>(defaultScreenConfig);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadScreenConfig().then((c) => {
      setConfig(c);
      setLoaded(true);
    });
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

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

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
                <ColorField label="Cor de fundo" value={config.totemBgColor} onChange={(v) => update("totemBgColor", v)} fieldKey="totemBgColor" />
                <ColorField label="Cor do texto" value={config.totemTextColor} onChange={(v) => update("totemTextColor", v)} fieldKey="totemTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor do botão (fundo)" value={config.totemButtonBgColor} onChange={(v) => update("totemButtonBgColor", v)} fieldKey="totemButtonBgColor" />
                <ColorField label="Cor do botão (texto)" value={config.totemButtonTextColor} onChange={(v) => update("totemButtonTextColor", v)} fieldKey="totemButtonTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Arredondamento do botão (px)</Label>
                  <Input type="number" value={config.totemButtonRadius} onChange={(e) => update("totemButtonRadius", e.target.value)} className="h-8 text-sm" min="0" max="50" />
                </div>
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.totemFontFamily || "default"} onValueChange={(v) => update("totemFontFamily", v === "default" ? "" : v)}>
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

              {/* Live Preview */}
              <div className="border-2 border-dashed border-border rounded-lg p-4 mt-4">
                <p className="text-xs text-muted-foreground text-center mb-2">Pré-visualização</p>
                <div
                  className="rounded-lg p-6 text-center"
                  style={{
                    backgroundColor: config.totemBgColor || PLACEHOLDER_COLORS.totemBgColor,
                    color: config.totemTextColor || PLACEHOLDER_COLORS.totemTextColor,
                    fontFamily: config.totemFontFamily || undefined,
                  }}
                >
                  <p className="text-lg font-bold">{config.totemTitle || "Sistema de Senhas"}</p>
                  <p className="text-sm opacity-80">{config.totemSubtitle || "Toque para retirar sua senha"}</p>
                  <div
                    className="inline-block mt-3 px-6 py-2 font-bold text-sm"
                    style={{
                      backgroundColor: config.totemButtonBgColor || PLACEHOLDER_COLORS.totemButtonBgColor,
                      color: config.totemButtonTextColor || PLACEHOLDER_COLORS.totemButtonTextColor,
                      borderRadius: `${config.totemButtonRadius || 12}px`,
                    }}
                  >
                    Exemplo Botão
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setConfig(prev => ({
                ...prev,
                totemTitle: defaultScreenConfig.totemTitle, totemSubtitle: defaultScreenConfig.totemSubtitle,
                totemBgColor: "", totemTextColor: "", totemButtonBgColor: "", totemButtonTextColor: "",
                totemButtonRadius: "12", totemFontFamily: "", totemLogoSize: "8", totemShowLogo: true,
              }))}>
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão do Totem
              </Button>
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
                <ColorField label="Cor de fundo" value={config.panelBgColor} onChange={(v) => update("panelBgColor", v)} fieldKey="panelBgColor" />
                <ColorField label="Cor do texto" value={config.panelTextColor} onChange={(v) => update("panelTextColor", v)} fieldKey="panelTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor da senha chamada" value={config.panelTicketColor} onChange={(v) => update("panelTicketColor", v)} fieldKey="panelTicketColor" />
                <ColorField label="Cor fundo cabeçalho" value={config.panelHeaderBgColor} onChange={(v) => update("panelHeaderBgColor", v)} fieldKey="panelHeaderBgColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor fundo rodapé" value={config.panelFooterBgColor} onChange={(v) => update("panelFooterBgColor", v)} fieldKey="panelFooterBgColor" />
                <ColorField label="Cor texto rodapé" value={config.panelFooterTextColor} onChange={(v) => update("panelFooterTextColor", v)} fieldKey="panelFooterTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.panelFontFamily || "default"} onValueChange={(v) => update("panelFontFamily", v === "default" ? "" : v)}>
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

              {/* Live Preview */}
              <div className="border-2 border-dashed border-border rounded-lg p-4 mt-4">
                <p className="text-xs text-muted-foreground text-center mb-2">Pré-visualização</p>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ backgroundColor: config.panelBgColor || PLACEHOLDER_COLORS.panelBgColor }}
                >
                  <div className="p-2 text-center" style={{ backgroundColor: config.panelHeaderBgColor || PLACEHOLDER_COLORS.panelHeaderBgColor }}>
                    <p className="text-sm font-bold" style={{ color: config.panelTextColor || PLACEHOLDER_COLORS.panelTextColor }}>
                      {config.panelTitle || "Painel de Chamadas"}
                    </p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-3xl font-black" style={{ color: config.panelTicketColor || PLACEHOLDER_COLORS.panelTicketColor }}>N0001</p>
                    <p className="text-sm mt-1" style={{ color: config.panelTextColor || PLACEHOLDER_COLORS.panelTextColor }}>Guichê 01</p>
                  </div>
                  <div className="p-2 text-center" style={{ backgroundColor: config.panelFooterBgColor || PLACEHOLDER_COLORS.panelFooterBgColor }}>
                    <p className="text-xs" style={{ color: config.panelFooterTextColor || PLACEHOLDER_COLORS.panelFooterTextColor }}>Últimas chamadas</p>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setConfig(prev => ({
                ...prev,
                panelBgColor: "", panelTextColor: "", panelTicketColor: "", panelShowLogo: false,
                panelTitle: "", panelFontFamily: "", panelHeaderBgColor: "", panelFooterBgColor: "",
                panelFooterTextColor: "", panelLogoSize: "5",
              }))}>
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão do Painel
              </Button>
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
                <ColorField label="Cor de fundo" value={config.counterBgColor} onChange={(v) => update("counterBgColor", v)} fieldKey="counterBgColor" />
                <ColorField label="Cor do texto" value={config.counterTextColor} onChange={(v) => update("counterTextColor", v)} fieldKey="counterTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor fundo cabeçalho" value={config.counterHeaderBgColor} onChange={(v) => update("counterHeaderBgColor", v)} fieldKey="counterHeaderBgColor" />
                <ColorField label="Cor texto cabeçalho" value={config.counterHeaderTextColor} onChange={(v) => update("counterHeaderTextColor", v)} fieldKey="counterHeaderTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor do botão (fundo)" value={config.counterButtonBgColor} onChange={(v) => update("counterButtonBgColor", v)} fieldKey="counterButtonBgColor" />
                <ColorField label="Cor do botão (texto)" value={config.counterButtonTextColor} onChange={(v) => update("counterButtonTextColor", v)} fieldKey="counterButtonTextColor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.counterFontFamily || "default"} onValueChange={(v) => update("counterFontFamily", v === "default" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Padrão" /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <Label className="text-xs">Mostrar logo</Label>
                  <Switch checked={config.counterShowLogo} onCheckedChange={(v) => update("counterShowLogo", v)} />
                </div>
              </div>

              {/* Live Preview */}
              <div className="border-2 border-dashed border-border rounded-lg p-4 mt-4">
                <p className="text-xs text-muted-foreground text-center mb-2">Pré-visualização</p>
                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: config.counterBgColor || PLACEHOLDER_COLORS.counterBgColor }}>
                  <div className="p-2" style={{ backgroundColor: config.counterHeaderBgColor || PLACEHOLDER_COLORS.counterHeaderBgColor }}>
                    <p className="text-sm font-bold" style={{ color: config.counterHeaderTextColor || PLACEHOLDER_COLORS.counterHeaderTextColor }}>
                      {config.counterTitle || "Painel do Guichê"}
                    </p>
                  </div>
                  <div className="p-4 text-center" style={{ color: config.counterTextColor || PLACEHOLDER_COLORS.counterTextColor }}>
                    <p className="text-2xl font-black">N0001</p>
                    <div
                      className="inline-block mt-2 px-4 py-1 rounded text-xs font-bold"
                      style={{
                        backgroundColor: config.counterButtonBgColor || PLACEHOLDER_COLORS.counterButtonBgColor,
                        color: config.counterButtonTextColor || PLACEHOLDER_COLORS.counterButtonTextColor,
                      }}
                    >
                      Chamar Próxima
                    </div>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setConfig(prev => ({
                ...prev,
                counterShowLogo: false, counterTitle: "Painel do Guichê",
                counterBgColor: "", counterTextColor: "", counterHeaderBgColor: "", counterHeaderTextColor: "",
                counterFontFamily: "", counterButtonBgColor: "", counterButtonTextColor: "",
              }))}>
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão do Guichê
              </Button>
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
