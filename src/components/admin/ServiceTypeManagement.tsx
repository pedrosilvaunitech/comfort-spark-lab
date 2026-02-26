import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export function ServiceTypeManagement() {
  const [types, setTypes] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadTypes(); }, []);

  const loadTypes = async () => {
    const { data } = await supabase.from("service_types").select("*").order("display_order");
    setTypes(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPrefix) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("service_types").insert({
        name: newName,
        prefix: newPrefix,
        description: newDesc || null,
        display_order: types.length,
      });
      if (error) throw error;
      toast.success("Tipo de serviço criado!");
      setNewName("");
      setNewPrefix("");
      setNewDesc("");
      loadTypes();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("service_types").update({ is_active: isActive }).eq("id", id);
    loadTypes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover tipo de serviço?")) return;
    await supabase.from("service_types").delete().eq("id", id);
    loadTypes();
    toast.success("Tipo removido");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Criar Tipo de Serviço</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Consulta Geral" required />
            </div>
            <div>
              <Label>Prefixo (letra da senha)</Label>
              <Input value={newPrefix} onChange={(e) => setNewPrefix(e.target.value.toUpperCase())} placeholder="C" maxLength={3} required />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Consultas médicas gerais" />
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> {creating ? "Criando..." : "Criar Tipo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tipos de Serviço ({types.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{t.prefix} — {t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={t.is_active} onCheckedChange={(v) => handleToggle(t.id, v)} />
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {types.length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum tipo</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
