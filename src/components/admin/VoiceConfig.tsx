import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, Volume2, RefreshCw } from "lucide-react";
import { getSystemConfig, updateSystemConfig } from "@/lib/ticket-service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VoiceSettings {
  template: string;
  rate: number;
  pitch: number;
  beepEnabled: boolean;
  repeatCount: number;
  voiceName: string;
  numberFormat: "full" | "no_zeros" | "digit_by_digit";
  prefixFormat: "senha" | "numero" | "senha_numero" | "custom";
  customPrefix: string;
  speakPrefix: boolean;
  /** Delay in seconds between consecutive announcements */
  delayBetween: number;
}

export const defaultVoiceSettings: VoiceSettings = {
  template: "{prefixo} {senha}, dirija-se ao {guiche}",
  rate: 0.9,
  pitch: 1,
  beepEnabled: true,
  repeatCount: 1,
  voiceName: "",
  numberFormat: "no_zeros",
  prefixFormat: "senha",
  customPrefix: "",
  speakPrefix: true,
};

export function formatNumberForSpeech(displayNumber: string, settings: VoiceSettings): string {
  const prefix = displayNumber.replace(/[0-9]/g, "").trim();
  const numStr = displayNumber.replace(/[^0-9]/g, "");
  const num = parseInt(numStr, 10);

  let spokenNumber: string;
  switch (settings.numberFormat) {
    case "full":
      spokenNumber = numStr;
      break;
    case "digit_by_digit":
      spokenNumber = numStr.split("").join(" ");
      break;
    case "no_zeros":
    default:
      spokenNumber = String(num);
      break;
  }

  const letterPrefix = settings.speakPrefix ? prefix : "";
  return letterPrefix ? `${letterPrefix} ${spokenNumber}` : spokenNumber;
}

export function formatPrefixForSpeech(settings: VoiceSettings): string {
  switch (settings.prefixFormat) {
    case "numero":
      return "Número";
    case "senha_numero":
      return "Senha número";
    case "custom":
      return settings.customPrefix || "";
    case "senha":
    default:
      return "Senha";
  }
}

export function formatTicketForSpeech(displayNumber: string, settings: VoiceSettings): string {
  const prefix = formatPrefixForSpeech(settings);
  const number = formatNumberForSpeech(displayNumber, settings);
  return prefix ? `${prefix} ${number}` : number;
}

export function VoiceConfig() {
  const [settings, setSettings] = useState<VoiceSettings>(defaultVoiceSettings);
  const [saving, setSaving] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    loadSettings();
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const loadVoices = () => {
    const voices = speechSynthesis.getVoices();
    // Show all voices, prioritize Portuguese ones
    const sorted = [...voices].sort((a, b) => {
      const aIsPt = a.lang.startsWith("pt") ? 0 : 1;
      const bIsPt = b.lang.startsWith("pt") ? 0 : 1;
      if (aIsPt !== bIsPt) return aIsPt - bIsPt;
      return a.name.localeCompare(b.name);
    });
    setAvailableVoices(sorted);
  };

  const loadSettings = async () => {
    const data = await getSystemConfig("voice_settings");
    if (data) setSettings({ ...defaultVoiceSettings, ...(data as unknown as VoiceSettings) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("system_config").upsert(
        { key: "voice_settings", value: settings as any },
        { onConflict: "key" }
      );
      toast.success("Configuração de voz salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const getPreviewTextFull = (displayNumber = "N0001") => {
    const prefix = formatPrefixForSpeech(settings);
    const number = formatNumberForSpeech(displayNumber, settings);
    let text = settings.template;
    if (text.includes("{prefixo}")) {
      text = text.replace("{prefixo}", prefix).replace("{senha}", number);
    } else {
      const fullSpoken = prefix ? `${prefix} ${number}` : number;
      text = text.replace("{senha}", fullSpoken);
    }
    return text.replace("{guiche}", "Guichê 1").replace(/\s+/g, " ").trim();
  };

  const handleTestVoice = () => {
    const text = getPreviewTextFull();

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;

    if (settings.voiceName) {
      const voice = availableVoices.find((v) => v.name === settings.voiceName);
      if (voice) utterance.voice = voice;
    } else {
      const voices = speechSynthesis.getVoices();
      const ptVoice = voices.find((v) => v.lang.startsWith("pt") && v.name.toLowerCase().includes("google"))
        || voices.find((v) => v.lang.startsWith("pt-BR"));
      if (ptVoice) utterance.voice = ptVoice;
    }

    speechSynthesis.speak(utterance);
  };

  const getVoiceLabel = (voice: SpeechSynthesisVoice) => {
    const langLabel = voice.lang;
    const defaultLabel = voice.default ? " ★" : "";
    return `${voice.name} (${langLabel})${defaultLabel}`;
  };

  const ptVoices = availableVoices.filter((v) => v.lang.startsWith("pt"));
  const otherVoices = availableVoices.filter((v) => !v.lang.startsWith("pt"));

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
              placeholder="{prefixo} {senha}, dirija-se ao {guiche}"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">{"{prefixo}"}</code> + <code className="bg-muted px-1 rounded">{"{senha}"}</code> para a chamada e{" "}
              <code className="bg-muted px-1 rounded">{"{guiche}"}</code> para o guichê. Ou use <code className="bg-muted px-1 rounded">{"{prefixo} {senha}"}</code> juntos.
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Como chamar o prefixo</Label>
            <RadioGroup
              value={settings.prefixFormat}
              onValueChange={(v) => setSettings({ ...settings, prefixFormat: v as VoiceSettings["prefixFormat"] })}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="senha" id="pf-senha" />
                <Label htmlFor="pf-senha" className="font-normal">Senha N 1 → <span className="text-muted-foreground">"Senha N 1"</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="numero" id="pf-numero" />
                <Label htmlFor="pf-numero" className="font-normal">N número 1 → <span className="text-muted-foreground">"N número 1"</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="senha_numero" id="pf-senha-numero" />
                <Label htmlFor="pf-senha-numero" className="font-normal">Senha número N 1 → <span className="text-muted-foreground">"Senha número N 1"</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="custom" id="pf-custom" />
                <Label htmlFor="pf-custom" className="font-normal">Personalizado</Label>
              </div>
            </RadioGroup>
            {settings.prefixFormat === "custom" && (
              <Input
                className="mt-2"
                value={settings.customPrefix}
                onChange={(e) => setSettings({ ...settings, customPrefix: e.target.value })}
                placeholder="Ex: Senha número"
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Falar a letra do prefixo (N, E, P...)</Label>
              <p className="text-xs text-muted-foreground">Se desativado, fala apenas o número sem a letra identificadora</p>
            </div>
            <Switch
              checked={settings.speakPrefix}
              onCheckedChange={(v) => setSettings({ ...settings, speakPrefix: v })}
            />
          </div>

          <div>
            <Label className="mb-2 block">Formato do número</Label>
            <RadioGroup
              value={settings.numberFormat}
              onValueChange={(v) => setSettings({ ...settings, numberFormat: v as VoiceSettings["numberFormat"] })}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no_zeros" id="nf-no-zeros" />
                <Label htmlFor="nf-no-zeros" className="font-normal">Sem zeros → 0001 fala <span className="text-muted-foreground">"1"</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id="nf-full" />
                <Label htmlFor="nf-full" className="font-normal">Número completo → 1002 fala <span className="text-muted-foreground">"1002"</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="digit_by_digit" id="nf-digit" />
                <Label htmlFor="nf-digit" className="font-normal">Dígito por dígito → 1002 fala <span className="text-muted-foreground">"1 0 0 2"</span></Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Voz</Label>
              <Button variant="ghost" size="sm" onClick={loadVoices} title="Recarregar vozes">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <Select
              value={settings.voiceName || "__auto__"}
              onValueChange={(v) => setSettings({ ...settings, voiceName: v === "__auto__" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione uma voz" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="__auto__">🔄 Automático (melhor pt-BR disponível)</SelectItem>
                {ptVoices.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                      🇧🇷 Português
                    </div>
                    {ptVoices.map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        {getVoiceLabel(v)}
                      </SelectItem>
                    ))}
                  </>
                )}
                {otherVoices.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                      🌐 Outros idiomas
                    </div>
                    {otherVoices.map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        {getVoiceLabel(v)}
                      </SelectItem>
                    ))}
                  </>
                )}
                {availableVoices.length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    Nenhuma voz encontrada. Clique em recarregar.
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {availableVoices.length} vozes disponíveis neste navegador
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
              {getPreviewTextFull()}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium mb-1">Voz selecionada:</p>
            <p className="text-sm">
              {settings.voiceName || "Automático (melhor pt-BR)"}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium mb-1">Exemplos de como soa:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>N0001 → "{getPreviewTextFull("N0001")}"</li>
              <li>E0015 → "{getPreviewTextFull("E0015")}"</li>
              <li>P1002 → "{getPreviewTextFull("P1002")}"</li>
            </ul>
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
