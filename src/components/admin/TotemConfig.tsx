import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSystemConfig } from "@/lib/ticket-service";
import { toast } from "sonner";

interface TotemConfigData {
  askName: boolean;
  askCpf: boolean;
}

const defaults: TotemConfigData = { askName: true, askCpf: true };

export function TotemConfig() {
  const [config, setConfig] = useState<TotemConfigData>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSystemConfig("totem_config").then((data) => {
      if (data) setConfig(data as unknown as TotemConfigData);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("system_config").upsert(
        { key: "totem_config", value: config as any },
        { onConflict: "key" }
      );
      toast.success("Configuração do totem salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Configuração do Totem</CardTitle>
        <CardDescription>Escolha quais informações pedir ao paciente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Pedir Nome do Paciente</Label>
          <Switch checked={config.askName} onCheckedChange={(v) => setConfig({ ...config, askName: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Pedir CPF do Paciente</Label>
          <Switch checked={config.askCpf} onCheckedChange={(v) => setConfig({ ...config, askCpf: v })} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
