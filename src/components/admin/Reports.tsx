import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Clock, CheckCircle, XCircle, TrendingUp, Timer } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142, 76%, 36%)",
  "hsl(0, 84%, 60%)",
  "hsl(48, 96%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
];

export function Reports() {
  const [stats, setStats] = useState<any>({
    total: 0, waiting: 0, called: 0, inService: 0, completed: 0, noShow: 0, cancelled: 0,
  });
  const [operatorStats, setOperatorStats] = useState<any[]>([]);
  const [serviceStats, setServiceStats] = useState<any[]>([]);
  const [hourlyStats, setHourlyStats] = useState<any[]>([]);
  const [avgWaitTime, setAvgWaitTime] = useState<number>(0);
  const [avgServiceTime, setAvgServiceTime] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: tickets } = await supabase
      .from("tickets")
      .select("*, counters(*), service_types(*)")
      .gte("created_at", `${today}T00:00:00`);

    const all = tickets || [];

    // Basic stats
    setStats({
      total: all.length,
      waiting: all.filter((t) => t.status === "waiting").length,
      called: all.filter((t) => t.status === "called").length,
      inService: all.filter((t) => t.status === "in_service").length,
      completed: all.filter((t) => t.status === "completed").length,
      noShow: all.filter((t) => t.status === "no_show").length,
      cancelled: all.filter((t) => t.status === "cancelled").length,
    });

    // Average wait time (created_at -> called_at)
    const withCallTime = all.filter((t) => t.called_at && t.created_at);
    if (withCallTime.length > 0) {
      const totalWait = withCallTime.reduce((sum, t) => {
        return sum + (new Date(t.called_at!).getTime() - new Date(t.created_at).getTime());
      }, 0);
      setAvgWaitTime(Math.round(totalWait / withCallTime.length / 60000)); // minutes
    } else {
      setAvgWaitTime(0);
    }

    // Average service time (called_at -> completed_at)
    const withServiceTime = all.filter((t) => t.called_at && t.completed_at);
    if (withServiceTime.length > 0) {
      const totalService = withServiceTime.reduce((sum, t) => {
        return sum + (new Date(t.completed_at!).getTime() - new Date(t.called_at!).getTime());
      }, 0);
      setAvgServiceTime(Math.round(totalService / withServiceTime.length / 60000));
    } else {
      setAvgServiceTime(0);
    }

    // Group by operator
    const { data: profiles } = await supabase.from("profiles").select("*");
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const opMap = new Map<string, { name: string; total: number; completed: number; noShow: number; avgTime: number }>();
    all.forEach((t) => {
      if (t.operator_id) {
        const existing = opMap.get(t.operator_id) || {
          name: profileMap.get(t.operator_id)?.full_name || "Desconhecido",
          total: 0, completed: 0, noShow: 0, avgTime: 0,
        };
        existing.total++;
        if (t.status === "completed") existing.completed++;
        if (t.status === "no_show") existing.noShow++;
        opMap.set(t.operator_id, existing);
      }
    });

    // Calculate avg service time per operator
    opMap.forEach((op, opId) => {
      const opTickets = all.filter((t) => t.operator_id === opId && t.called_at && t.completed_at);
      if (opTickets.length > 0) {
        const total = opTickets.reduce((sum, t) => {
          return sum + (new Date(t.completed_at!).getTime() - new Date(t.called_at!).getTime());
        }, 0);
        op.avgTime = Math.round(total / opTickets.length / 60000);
      }
    });

    setOperatorStats(Array.from(opMap.entries()).map(([id, s]) => ({ id, ...s })));

    // Group by service type
    const svcMap = new Map<string, { name: string; count: number }>();
    all.forEach((t) => {
      const name = (t as any).service_types?.name || "Sem tipo";
      const existing = svcMap.get(name) || { name, count: 0 };
      existing.count++;
      svcMap.set(name, existing);
    });
    setServiceStats(Array.from(svcMap.values()));

    // Hourly distribution
    const hourMap = new Map<number, number>();
    for (let h = 6; h <= 22; h++) hourMap.set(h, 0);
    all.forEach((t) => {
      const hour = new Date(t.created_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });
    setHourlyStats(
      Array.from(hourMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, count]) => ({ hour: `${hour}h`, count }))
    );

    setLoading(false);
  };

  const statusPieData = [
    { name: "Concluídos", value: stats.completed },
    { name: "Aguardando", value: stats.waiting },
    { name: "Chamados", value: stats.called },
    { name: "Atendendo", value: stats.inService },
    { name: "Não Compareceu", value: stats.noShow },
    { name: "Cancelados", value: stats.cancelled },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-foreground">Relatório do Dia</h2>
        <Button onClick={loadStats} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
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

      {/* Averages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Timer className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-3xl font-bold text-foreground">{avgWaitTime} min</p>
            <p className="text-sm text-muted-foreground">Tempo médio de espera</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <p className="text-3xl font-bold text-foreground">{avgServiceTime} min</p>
            <p className="text-sm text-muted-foreground">Tempo médio de atendimento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-3xl font-bold text-foreground">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Taxa de conclusão</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Senhas por Hora</CardTitle>
            <CardDescription>Distribuição de senhas geradas ao longo do dia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--card-foreground))",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Senhas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Proporção dos status das senhas do dia</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-16">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>

        {/* By Service Type */}
        <Card>
          <CardHeader>
            <CardTitle>Senhas por Tipo de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {serviceStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={serviceStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Senhas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-16">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Operator Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por Operador</CardTitle>
          </CardHeader>
          <CardContent>
            {operatorStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={operatorStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Bar dataKey="completed" fill="hsl(142, 76%, 36%)" name="Concluídos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="noShow" fill="hsl(0, 84%, 60%)" name="Não compareceu" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-16">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operator Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Operador</CardTitle>
        </CardHeader>
        <CardContent>
          {operatorStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3">Operador</th>
                    <th className="text-center p-3">Total</th>
                    <th className="text-center p-3">Concluídos</th>
                    <th className="text-center p-3">Não Compareceu</th>
                    <th className="text-center p-3">Tempo Médio</th>
                    <th className="text-center p-3">Taxa Conclusão</th>
                  </tr>
                </thead>
                <tbody>
                  {operatorStats.map((op) => (
                    <tr key={op.id} className="border-b border-border">
                      <td className="p-3 font-medium text-foreground">{op.name}</td>
                      <td className="p-3 text-center">{op.total}</td>
                      <td className="p-3 text-center">
                        <Badge variant="default" className="bg-green-600">{op.completed}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="destructive">{op.noShow}</Badge>
                      </td>
                      <td className="p-3 text-center">{op.avgTime} min</td>
                      <td className="p-3 text-center">
                        {op.total > 0 ? Math.round((op.completed / op.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum atendimento registrado hoje</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
