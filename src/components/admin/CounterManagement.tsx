import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export function CounterManagement() {
  const [counters, setCounters] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadCounters(); }, []);

  const loadCounters = async () => {
    const { data } = await supabase.from("counters").select("*").order("number");
    setCounters(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("counters").insert({ name: newName, number: newNumber });
      if (error) throw error;
      toast.success("Guichê criado!");
      setNewName("");
      setNewNumber((counters.length || 0) + 2);
      loadCounters();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("counters").update({ is_active: isActive }).eq("id", id);
    loadCounters();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover guichê?")) return;
    // Clear current_ticket and unlink tickets referencing this counter first
    await supabase.from("counters").update({ current_ticket_id: null }).eq("id", id);
    await supabase.from("tickets").update({ counter_id: null }).eq("counter_id", id);
    const { error } = await supabase.from("counters").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover guichê: " + error.message);
      return;
    }
    loadCounters();
    toast.success("Guichê removido");
  };

  const handleUpdateName = async (id: string, name: string) => {
    await supabase.from("counters").update({ name }).eq("id", id);
    toast.success("Nome atualizado");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Criar Guichê</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Nome do Guichê</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Guichê 1" required />
            </div>
            <div>
              <Label>Número</Label>
              <Input type="number" value={newNumber} onChange={(e) => setNewNumber(Number(e.target.value))} min={1} required />
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> {creating ? "Criando..." : "Criar Guichê"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Guichês ({counters.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {counters.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-foreground">#{c.number} — {c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.operator_name || "Sem operador"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={c.is_active} onCheckedChange={(v) => handleToggle(c.id, v)} />
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {counters.length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum guichê</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
