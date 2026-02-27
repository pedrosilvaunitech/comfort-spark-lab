import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Save, Volume2 } from "lucide-react";
import { getSystemConfig, updateSystemConfig } from "@/lib/ticket-service";
import { toast } from "sonner";

export interface VoiceSettings {
  template: string; // e.g. "Senha {senha}, dirija-se ao {guiche}"
  rate: number;
  pitch: number;
  beepEnabled: boolean;
  repeatCount: number;
}

const defaultVoiceSettings: VoiceSettings = {
  template: "Senha {senha}, dirija-se ao {guiche}",
  rate: 0.9,
  pitch: 1,
  beepEnabled: true,
  repeatCount: 1,
};

export function VoiceConfig() {
  const [settings, setSettings] = useState<VoiceSettings>(defaultVoiceSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getSystemConfig("voice_settings");
    if (data) setSettings(data as unknown as VoiceSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert: try update, if no rows affected, insert
      const { error } = await import("@/integrations/supabase/client").then(m =>
        m.supabase.from("system_config").upsert(
          { key: "voice_settings", value: settings as any },
          { onConflict: "key" }
        )
      );
      if (error) throw error;
      toast.success("Configuração de voz salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTestVoice = () => {
    const text = settings.template
      .replace("{senha}", "N 1")
      .replace("{guiche}", "Guichê 1");

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;

    const voices = speechSynthesis.getVoices();
    const ptVoice = voices.find(
      (v) => v.lang.startsWith("pt") && v.name.toLowerCase().includes("google")
    ) || voices.find((v) => v.lang.startsWith("pt-BR"));
    if (ptVoice) utterance.voice = ptVoice;

    speechSynthesis.speak(utterance);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Voz</CardTitle>
          <CardDescription>Personalize o que a voz diz ao chamar uma senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Modelo da frase</Label>
            <Input
              value={settings.template}
              onChange={(e) => setSettings({ ...settings, template: e.target.value })}
              placeholder="Senha {senha}, dirija-se ao {guiche}"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">{"{senha}"}</code> para o número e{" "}
              <code className="bg-muted px-1 rounded">{"{guiche}"}</code> para o nome do guichê.
            </p>
          </div>

          <div>
            <Label>Velocidade da fala: {settings.rate.toFixed(1)}</Label>
            <Slider
              value={[settings.rate]}
              onValueChange={([v]) => setSettings({ ...settings, rate: v })}
              min={0.5}
              max={1.5}
              step={0.1}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Tom da voz: {settings.pitch.toFixed(1)}</Label>
            <Slider
              value={[settings.pitch]}
              onValueChange={([v]) => setSettings({ ...settings, pitch: v })}
              min={0.5}
              max={2}
              step={0.1}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Bip antes do anúncio</Label>
            <Switch
              checked={settings.beepEnabled}
              onCheckedChange={(v) => setSettings({ ...settings, beepEnabled: v })}
            />
          </div>

          <div>
            <Label>Repetir anúncio: {settings.repeatCount}x</Label>
            <Slider
              value={[settings.repeatCount]}
              onValueChange={([v]) => setSettings({ ...settings, repeatCount: v })}
              min={1}
              max={3}
              step={1}
              className="mt-2"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
          <CardDescription>Teste como a voz vai soar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium mb-1">Frase que será dita:</p>
            <p className="text-lg font-mono">
              {settings.template
                .replace("{senha}", "N 1")
                .replace("{guiche}", "Guichê 1")}
            </p>
          </div>
          <Button onClick={handleTestVoice} variant="outline" className="w-full">
            <Volume2 className="h-4 w-4 mr-2" />
            Testar Voz
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
