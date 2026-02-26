import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Clock, CheckCircle, XCircle } from "lucide-react";

export function Reports() {
  const [stats, setStats] = useState<any>({
    total: 0, waiting: 0, called: 0, inService: 0, completed: 0, noShow: 0, cancelled: 0,
  });
  const [operatorStats, setOperatorStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: tickets } = await supabase
      .from("tickets")
      .select("*, counters(*)")
      .gte("created_at", `${today}T00:00:00`);

    const all = tickets || [];
    setStats({
      total: all.length,
      waiting: all.filter((t) => t.status === "waiting").length,
      called: all.filter((t) => t.status === "called").length,
      inService: all.filter((t) => t.status === "in_service").length,
      completed: all.filter((t) => t.status === "completed").length,
      noShow: all.filter((t) => t.status === "no_show").length,
      cancelled: all.filter((t) => t.status === "cancelled").length,
    });

    // Group by operator
    const { data: profiles } = await supabase.from("profiles").select("*");
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const opMap = new Map<string, { name: string; count: number; completed: number }>();
    all.forEach((t) => {
      if (t.operator_id) {
        const existing = opMap.get(t.operator_id) || {
          name: profileMap.get(t.operator_id)?.full_name || "Desconhecido",
          count: 0,
          completed: 0,
        };
        existing.count++;
        if (t.status === "completed") existing.completed++;
        opMap.set(t.operator_id, existing);
      }
    });
    setOperatorStats(Array.from(opMap.entries()).map(([id, s]) => ({ id, ...s })));
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-foreground">Relatório do Dia</h2>
        <Button onClick={loadStats} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
          { label: "Aguardando", value: stats.waiting, icon: Clock, color: "text-yellow-500" },
          { label: "Chamados", value: stats.called, icon: Users, color: "text-blue-500" },
          { label: "Atendendo", value: stats.inService, icon: Users, color: "text-orange-500" },
          { label: "Concluídos", value: stats.completed, icon: CheckCircle, color: "text-green-500" },
          { label: "Não Compareceu", value: stats.noShow, icon: XCircle, color: "text-red-500" },
          { label: "Cancelados", value: stats.cancelled, icon: XCircle, color: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atendimentos por Operador</CardTitle>
        </CardHeader>
        <CardContent>
          {operatorStats.length > 0 ? (
            <div className="space-y-3">
              {operatorStats.map((op) => (
                <div key={op.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{op.name}</p>
                    <p className="text-sm text-muted-foreground">{op.count} atendimentos</p>
                  </div>
                  <Badge variant="default">{op.completed} concluídos</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nenhum atendimento registrado hoje</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
