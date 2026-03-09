import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, ShieldAlert } from "lucide-react";
import { getSystemConfig, updateSystemConfig } from "@/lib/ticket-service";
import { toast } from "sonner";

export interface PrioritySettings {
  enabled: boolean;
  mode: "percentage" | "every_n" | "always_first";
  /** percentage mode: % chance of calling priority next */
  percentage: number;
  /** every_n mode: after every N normal tickets, call priority */
  everyN: number;
  /** how many priority tickets to call in sequence when triggered */
  burstCount: number;
  /** also apply to preferential tickets */
  includePreferential: boolean;
}

const defaultSettings: PrioritySettings = {
  enabled: true,
  mode: "every_n",
  percentage: 30,
  everyN: 3,
  burstCount: 1,
  includePreferential: true,
};

export function PriorityConfig() {
  const [settings, setSettings] = useState<PrioritySettings>(defaultSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSystemConfig("priority_settings").then((val) => {
      if (val) setSettings({ ...defaultSettings, ...(val as unknown as PrioritySettings) });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSystemConfig("priority_settings", settings as any);
      toast.success("Configuração de prioridade salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const patch = (p: Partial<PrioritySettings>) => setSettings((s) => ({ ...s, ...p }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Configuração de Prioridade
          </CardTitle>
          <CardDescription>
            Defina como e com que frequência as senhas prioritárias/preferenciais são chamadas antes das normais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label>Ativar chamada prioritária automática</Label>
            <Switch checked={settings.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
          </div>

          {settings.enabled && (
            <>
              <div>
                <Label className="mb-2 block">Modo de priorização</Label>
                <Select value={settings.mode} onValueChange={(v: PrioritySettings["mode"]) => patch({ mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always_first">Sempre primeiro (prioridade absoluta)</SelectItem>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="every_n">A cada N senhas normais</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.mode === "always_first" && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  Senhas prioritárias/preferenciais serão <strong>sempre</strong> chamadas antes de qualquer senha normal na fila.
                </p>
              )}

              {settings.mode === "percentage" && (
                <div>
                  <Label>Porcentagem de prioridade ({settings.percentage}%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.percentage}
                    onChange={(e) => patch({ percentage: Math.min(100, Math.max(1, Number(e.target.value))) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Chance de {settings.percentage}% de chamar uma senha prioritária a cada chamada.
                  </p>
                </div>
              )}

              {settings.mode === "every_n" && (
                <div>
                  <Label>A cada quantas senhas normais chamar uma prioritária</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.everyN}
                    onChange={(e) => patch({ everyN: Math.min(50, Math.max(1, Number(e.target.value))) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Após {settings.everyN} senha(s) normal(is), a próxima chamada será prioritária.
                  </p>
                </div>
              )}

              {settings.mode !== "always_first" && (
                <div>
                  <Label>Quantas prioritárias chamar em sequência</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={settings.burstCount}
                    onChange={(e) => patch({ burstCount: Math.min(10, Math.max(1, Number(e.target.value))) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando ativado, chama {settings.burstCount} senha(s) prioritária(s) antes de voltar às normais.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Incluir senhas preferenciais</Label>
                  <p className="text-xs text-muted-foreground">Tratar senhas preferenciais com a mesma prioridade</p>
                </div>
                <Switch checked={settings.includePreferential} onCheckedChange={(v) => patch({ includePreferential: v })} />
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
