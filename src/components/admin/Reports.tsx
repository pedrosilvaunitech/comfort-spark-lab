import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Users, Clock, CheckCircle, XCircle, TrendingUp, Timer, CalendarIcon, UserCheck } from "lucide-react";
import { format, subDays, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
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

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";
type ReportView = "overview" | "operator";

export function Reports() {
  const [stats, setStats] = useState<any>({
    total: 0, waiting: 0, called: 0, inService: 0, completed: 0, noShow: 0, cancelled: 0,
  });
  const [operatorStats, setOperatorStats] = useState<any[]>([]);
  const [serviceStats, setServiceStats] = useState<any[]>([]);
  const [hourlyStats, setHourlyStats] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [operatorDailyStats, setOperatorDailyStats] = useState<any[]>([]);
  const [operatorHourlyStats, setOperatorHourlyStats] = useState<any[]>([]);
  const [avgWaitTime, setAvgWaitTime] = useState<number>(0);
  const [avgServiceTime, setAvgServiceTime] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [reportView, setReportView] = useState<ReportView>("overview");
  const [selectedOperator, setSelectedOperator] = useState<string>("all");

  // Auto-load on mount + auto-refresh every 15s
  useEffect(() => {
    applyPreset("today");
    const interval = setInterval(() => {
      loadStatsForRange(dateFrom, dateTo);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadStatsForRange(dateFrom, dateTo);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateFrom, dateTo]);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const now = new Date();
    let from = now, to = now;
    switch (p) {
      case "today": from = now; to = now; break;
      case "yesterday": from = subDays(now, 1); to = subDays(now, 1); break;
      case "week": from = startOfWeek(now, { weekStartsOn: 1 }); to = now; break;
      case "month": from = startOfMonth(now); to = now; break;
      default: return;
    }
    setDateFrom(from);
    setDateTo(to);
    loadStatsForRange(from, to);
  };

  const handleCustomRange = () => {
    setPreset("custom");
    loadStatsForRange(dateFrom, dateTo);
  };

  const loadStatsForRange = async (from: Date, to: Date) => {
    setLoading(true);
    const fromStr = format(from, "yyyy-MM-dd") + "T00:00:00";
    const toStr = format(to, "yyyy-MM-dd") + "T23:59:59";

    try {
      // Fetch all tickets with pagination
      let all: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("tickets")
          .select("*, counters(*), service_types(*)")
          .gte("created_at", fromStr)
          .lte("created_at", toStr)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) {
          console.error("[Reports] Query error:", error);
          break;
        }
        const batch = data || [];
        all = all.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      console.log(`[Reports] Loaded ${all.length} tickets for ${format(from, "dd/MM")} - ${format(to, "dd/MM")}`);

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

      // Average wait time
      const withCallTime = all.filter((t) => t.called_at && t.created_at);
      if (withCallTime.length > 0) {
        const totalWait = withCallTime.reduce((sum, t) =>
          sum + (new Date(t.called_at!).getTime() - new Date(t.created_at).getTime()), 0);
        setAvgWaitTime(Math.round(totalWait / withCallTime.length / 60000));
      } else setAvgWaitTime(0);

      // Average service time
      const withServiceTime = all.filter((t) => t.called_at && t.completed_at);
      if (withServiceTime.length > 0) {
        const totalService = withServiceTime.reduce((sum, t) =>
          sum + (new Date(t.completed_at!).getTime() - new Date(t.called_at!).getTime()), 0);
        setAvgServiceTime(Math.round(totalService / withServiceTime.length / 60000));
      } else setAvgServiceTime(0);

      // Fetch profiles for operator names
      const { data: profiles } = await supabase.from("profiles").select("*");
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      // Group by operator with detailed metrics
      const opMap = new Map<string, {
        name: string; total: number; completed: number; noShow: number;
        avgWait: number; avgTime: number; ticketsByHour: Map<number, number>;
        ticketsByDay: Map<string, number>;
      }>();

      all.forEach((t) => {
        if (t.operator_id) {
          const existing = opMap.get(t.operator_id) || {
            name: profileMap.get(t.operator_id)?.full_name || "Desconhecido",
            total: 0, completed: 0, noShow: 0, avgWait: 0, avgTime: 0,
            ticketsByHour: new Map<number, number>(),
            ticketsByDay: new Map<string, number>(),
          };
          existing.total++;
          if (t.status === "completed") existing.completed++;
          if (t.status === "no_show") existing.noShow++;
          
          // Hour distribution per operator
          const hour = new Date(t.created_at).getHours();
          existing.ticketsByHour.set(hour, (existing.ticketsByHour.get(hour) || 0) + 1);
          
          // Day distribution per operator
          const day = format(new Date(t.created_at), "dd/MM");
          existing.ticketsByDay.set(day, (existing.ticketsByDay.get(day) || 0) + 1);
          
          opMap.set(t.operator_id, existing);
        }
      });

      // Calculate avg times per operator
      opMap.forEach((op, opId) => {
        const opTickets = all.filter((t) => t.operator_id === opId);
        const withService = opTickets.filter((t) => t.called_at && t.completed_at);
        if (withService.length > 0) {
          const total = withService.reduce((sum, t) =>
            sum + (new Date(t.completed_at!).getTime() - new Date(t.called_at!).getTime()), 0);
          op.avgTime = Math.round(total / withService.length / 60000);
        }
        const withWait = opTickets.filter((t) => t.called_at && t.created_at);
        if (withWait.length > 0) {
          const totalW = withWait.reduce((sum, t) =>
            sum + (new Date(t.called_at!).getTime() - new Date(t.created_at).getTime()), 0);
          op.avgWait = Math.round(totalW / withWait.length / 60000);
        }
      });

      const opArray = Array.from(opMap.entries()).map(([id, s]) => ({ id, ...s }));
      setOperatorStats(opArray);

      // Build per-operator hourly data for selected operator
      buildOperatorCharts(opArray, all);

      // Service type stats
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
        Array.from(hourMap.entries()).sort(([a], [b]) => a - b)
          .map(([hour, count]) => ({ hour: `${hour}h`, count }))
      );

      // Daily distribution
      const dayMap = new Map<string, number>();
      all.forEach((t) => {
        const day = format(new Date(t.created_at), "dd/MM");
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });
      setDailyStats(Array.from(dayMap.entries()).map(([day, count]) => ({ day, count })));

      // Monthly distribution (last 6 months context)
      const monthMap = new Map<string, { month: string; total: number; completed: number; avgTime: number }>();
      all.forEach((t) => {
        const m = format(new Date(t.created_at), "MMM/yy", { locale: ptBR });
        const existing = monthMap.get(m) || { month: m, total: 0, completed: 0, avgTime: 0 };
        existing.total++;
        if (t.status === "completed") existing.completed++;
        monthMap.set(m, existing);
      });
      setMonthlyStats(Array.from(monthMap.values()));

    } catch (err) {
      console.error("[Reports] Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildOperatorCharts = (ops: any[], allTickets: any[]) => {
    // Per-operator daily breakdown
    const opDailyData: any[] = [];
    const allDays = new Set<string>();
    allTickets.forEach(t => allDays.add(format(new Date(t.created_at), "dd/MM")));
    
    Array.from(allDays).sort().forEach(day => {
      const entry: any = { day };
      ops.forEach(op => {
        entry[op.name] = op.ticketsByDay?.get(day) || 0;
      });
      opDailyData.push(entry);
    });
    setOperatorDailyStats(opDailyData);

    // Per-operator hourly breakdown
    const opHourlyData: any[] = [];
    for (let h = 6; h <= 22; h++) {
      const entry: any = { hour: `${h}h` };
      ops.forEach(op => {
        entry[op.name] = op.ticketsByHour?.get(h) || 0;
      });
      opHourlyData.push(entry);
    }
    setOperatorHourlyStats(opHourlyData);
  };

  const statusPieData = [
    { name: "Concluídos", value: stats.completed },
    { name: "Aguardando", value: stats.waiting },
    { name: "Chamados", value: stats.called },
    { name: "Atendendo", value: stats.inService },
    { name: "Não Compareceu", value: stats.noShow },
    { name: "Cancelados", value: stats.cancelled },
  ].filter((d) => d.value > 0);

  const isMultiDay = format(dateFrom, "yyyy-MM-dd") !== format(dateTo, "yyyy-MM-dd");
  const periodLabel = preset === "today" ? "Hoje" : preset === "yesterday" ? "Ontem"
    : preset === "week" ? "Esta Semana" : preset === "month" ? "Este Mês"
    : `${format(dateFrom, "dd/MM/yyyy")} - ${format(dateTo, "dd/MM/yyyy")}`;

  const filteredOperator = selectedOperator !== "all"
    ? operatorStats.find(o => o.id === selectedOperator) : null;

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--card-foreground))",
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-foreground mr-2">Relatórios</h2>
        {(["today", "yesterday", "week", "month"] as DatePreset[]).map((p) => (
          <Button key={p} variant={preset === p ? "default" : "outline"} size="sm" onClick={() => applyPreset(p)}>
            {p === "today" ? "Hoje" : p === "yesterday" ? "Ontem" : p === "week" ? "Semana" : "Mês"}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant={preset === "custom" ? "default" : "outline"} size="sm">
              <CalendarIcon className="h-4 w-4 mr-1" />
              {preset === "custom" ? `${format(dateFrom, "dd/MM")} - ${format(dateTo, "dd/MM")}` : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 space-y-3" align="end">
            <div className="space-y-2">
              <p className="text-sm font-medium">De:</p>
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              <p className="text-sm font-medium">Até:</p>
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
            </div>
            <Button onClick={handleCustomRange} className="w-full" size="sm">Filtrar</Button>
          </PopoverContent>
        </Popover>

        <Button onClick={() => loadStatsForRange(dateFrom, dateTo)} variant="ghost" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">{periodLabel}</span>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        <Button variant={reportView === "overview" ? "default" : "outline"} size="sm" onClick={() => setReportView("overview")}>
          <TrendingUp className="h-4 w-4 mr-1" /> Visão Geral
        </Button>
        <Button variant={reportView === "operator" ? "default" : "outline"} size="sm" onClick={() => setReportView("operator")}>
          <UserCheck className="h-4 w-4 mr-1" /> Por Atendente
        </Button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      )}

      {!loading && stats.total === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma senha encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Não há dados para o período selecionado ({periodLabel})</p>
          </CardContent>
        </Card>
      )}

      {!loading && stats.total > 0 && reportView === "overview" && (
        <>
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

          {/* Daily trend for multi-day */}
          {isMultiDay && dailyStats.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Senhas por Dia</CardTitle>
                <CardDescription>Tendência diária no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Senhas" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Senhas por Hora</CardTitle>
                <CardDescription>Distribuição ao longo do dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={hourlyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Senhas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {statusPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-16">Sem dados</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Senhas por Tipo de Serviço</CardTitle></CardHeader>
              <CardContent>
                {serviceStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={serviceStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" allowDecimals={false} className="text-xs" />
                      <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Senhas" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-16">Sem dados</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Desempenho por Operador</CardTitle></CardHeader>
              <CardContent>
                {operatorStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={operatorStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis allowDecimals={false} className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="completed" fill="hsl(142, 76%, 36%)" name="Concluídos" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="noShow" fill="hsl(0, 84%, 60%)" name="Não compareceu" radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-16">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Monthly view */}
          {monthlyStats.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Visão Mensal</CardTitle>
                <CardDescription>Total e concluídos por mês</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" fill="hsl(142, 76%, 36%)" name="Concluídos" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Operator Table */}
          <Card>
            <CardHeader><CardTitle>Detalhamento por Operador</CardTitle></CardHeader>
            <CardContent>
              {operatorStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-foreground">Operador</th>
                        <th className="text-center p-3 text-foreground">Total</th>
                        <th className="text-center p-3 text-foreground">Concluídos</th>
                        <th className="text-center p-3 text-foreground">Não Compareceu</th>
                        <th className="text-center p-3 text-foreground">Espera Média</th>
                        <th className="text-center p-3 text-foreground">Atend. Médio</th>
                        <th className="text-center p-3 text-foreground">Taxa Conclusão</th>
                        <th className="text-center p-3 text-foreground">Senhas/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operatorStats.map((op) => (
                        <tr key={op.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-3 font-medium text-foreground">{op.name}</td>
                          <td className="p-3 text-center text-foreground">{op.total}</td>
                          <td className="p-3 text-center"><Badge variant="default" className="bg-green-600">{op.completed}</Badge></td>
                          <td className="p-3 text-center"><Badge variant="destructive">{op.noShow}</Badge></td>
                          <td className="p-3 text-center text-foreground">{op.avgWait} min</td>
                          <td className="p-3 text-center text-foreground">{op.avgTime} min</td>
                          <td className="p-3 text-center text-foreground">{op.total > 0 ? Math.round((op.completed / op.total) * 100) : 0}%</td>
                          <td className="p-3 text-center text-foreground">
                            {op.avgTime > 0 ? (60 / op.avgTime).toFixed(1) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-center text-muted-foreground py-8">Nenhum atendimento registrado</p>}
            </CardContent>
          </Card>
        </>
      )}

      {/* OPERATOR VIEW */}
      {!loading && stats.total > 0 && reportView === "operator" && (
        <>
          <div className="flex items-center gap-3">
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecionar atendente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Atendentes</SelectItem>
                {operatorStats.map(op => (
                  <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operator summary cards */}
          {filteredOperator && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{filteredOperator.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-500">{filteredOperator.completed}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{filteredOperator.noShow}</p>
                <p className="text-xs text-muted-foreground">Não Compareceu</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{filteredOperator.avgWait} min</p>
                <p className="text-xs text-muted-foreground">Espera Média</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{filteredOperator.avgTime} min</p>
                <p className="text-xs text-muted-foreground">Atend. Médio</p>
              </CardContent></Card>
            </div>
          )}

          {/* Operator hourly chart */}
          <Card>
            <CardHeader>
              <CardTitle>Atendimentos por Hora {filteredOperator ? `- ${filteredOperator.name}` : "(Todos)"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={operatorHourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip contentStyle={tooltipStyle} />
                  {selectedOperator === "all" ? (
                    operatorStats.map((op, i) => (
                      <Bar key={op.id} dataKey={op.name} fill={COLORS[i % COLORS.length]} stackId="a" name={op.name} />
                    ))
                  ) : filteredOperator ? (
                    <Bar dataKey={filteredOperator.name} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={filteredOperator.name} />
                  ) : null}
                  {selectedOperator === "all" && <Legend />}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Operator daily chart (multi-day) */}
          {isMultiDay && operatorDailyStats.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Atendimentos por Dia {filteredOperator ? `- ${filteredOperator.name}` : "(Todos)"}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={operatorDailyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip contentStyle={tooltipStyle} />
                    {selectedOperator === "all" ? (
                      operatorStats.map((op, i) => (
                        <Line key={op.id} type="monotone" dataKey={op.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} name={op.name} />
                      ))
                    ) : filteredOperator ? (
                      <Line type="monotone" dataKey={filteredOperator.name} stroke="hsl(var(--primary))" strokeWidth={2} name={filteredOperator.name} />
                    ) : null}
                    {selectedOperator === "all" && <Legend />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* All operators comparison table */}
          <Card>
            <CardHeader><CardTitle>Comparativo de Atendentes</CardTitle></CardHeader>
            <CardContent>
              {operatorStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-foreground">Atendente</th>
                        <th className="text-center p-3 text-foreground">Total</th>
                        <th className="text-center p-3 text-foreground">Concluídos</th>
                        <th className="text-center p-3 text-foreground">Espera Média</th>
                        <th className="text-center p-3 text-foreground">Atend. Médio</th>
                        <th className="text-center p-3 text-foreground">Senhas/Hora</th>
                        <th className="text-center p-3 text-foreground">Eficiência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operatorStats.sort((a, b) => b.completed - a.completed).map((op) => (
                        <tr key={op.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-3 font-medium text-foreground">{op.name}</td>
                          <td className="p-3 text-center text-foreground">{op.total}</td>
                          <td className="p-3 text-center"><Badge className="bg-green-600 text-white">{op.completed}</Badge></td>
                          <td className="p-3 text-center text-foreground">{op.avgWait} min</td>
                          <td className="p-3 text-center text-foreground">{op.avgTime} min</td>
                          <td className="p-3 text-center text-foreground">{op.avgTime > 0 ? (60 / op.avgTime).toFixed(1) : "—"}</td>
                          <td className="p-3 text-center">
                            <Badge variant={
                              op.total > 0 && (op.completed / op.total) >= 0.8 ? "default" :
                              op.total > 0 && (op.completed / op.total) >= 0.5 ? "secondary" : "destructive"
                            }>
                              {op.total > 0 ? Math.round((op.completed / op.total) * 100) : 0}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-center text-muted-foreground py-8">Nenhum atendente com dados</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
