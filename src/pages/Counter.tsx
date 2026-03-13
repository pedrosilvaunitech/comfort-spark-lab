import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  getCounters,
  callNextTicket,
  completeTicket,
  markNoShow,
} from "@/lib/ticket-service";
import { printTicket } from "@/lib/print-service";
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Printer, SkipForward, LogOut, Volume2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useScreenConfig } from "@/hooks/use-screen-config";

const CounterPage = () => {
  const { user, loading: authLoading, isOperator, signOut } = useAuth();
  const location = useLocation();
  const [selectedCounterId, setSelectedCounterId] = useState<string>(
    (location.state as any)?.counterId || ""
  );
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { counters, waitingTickets, calledTickets, refresh } = useRealtimeTickets();
  const { config: screenConfig } = useScreenConfig();

  const selectedCounter = counters.find((c: any) => c.id === selectedCounterId);

  useEffect(() => {
    const counterTicket = selectedCounter?.tickets;
    const ticket = Array.isArray(counterTicket) ? counterTicket[0] : counterTicket;
    if (ticket) {
      setCurrentTicket(ticket);
    } else if (selectedCounter && !selectedCounter.current_ticket_id) {
      setCurrentTicket(null);
    }
  }, [selectedCounter, counters]);

  const releaseCounter = async (counterId: string) => {
    await supabase.from("counters").update({ operator_name: null, current_ticket_id: null }).eq("id", counterId);
  };

  useEffect(() => {
    if (selectedCounterId && user) {
      supabase.from("counters").update({ operator_name: user.user_metadata?.full_name || user.email }).eq("id", selectedCounterId);
    }

    const handleBeforeUnload = () => {
      if (selectedCounterId) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/counters?id=eq.${selectedCounterId}`;
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ operator_name: null, current_ticket_id: null }),
          keepalive: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (selectedCounterId) releaseCounter(selectedCounterId);
    };
  }, [selectedCounterId, user]);

  const handleCallNext = async () => {
    if (!selectedCounterId) { toast.error("Selecione um guichê"); return; }
    setLoading(true);
    try {
      const ticket = await callNextTicket(selectedCounterId, user?.id);
      if (ticket) {
        setCurrentTicket(ticket);
        toast.success(`Senha ${ticket.display_number} chamada e atendimento iniciado!`);
      } else {
        toast.info("Nenhuma senha na fila");
        setCurrentTicket(null);
      }
      refresh();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleCallSpecific = async (ticketId: string) => {
    if (!selectedCounterId) { toast.error("Selecione um guichê primeiro"); return; }
    setLoading(true);
    try {
      const { data: counter } = await supabase.from("counters").select("*").eq("id", selectedCounterId).single();
      if (!counter) throw new Error("Guichê não encontrado");
      if (counter.current_ticket_id) {
        await supabase.from("tickets")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", counter.current_ticket_id);
      }
      const { data: updatedTicket, error } = await supabase.from("tickets")
        .update({
          status: "in_service",
          counter_id: selectedCounterId,
          called_at: new Date().toISOString(),
          operator_id: user?.id || null,
        })
        .eq("id", ticketId)
        .select()
        .single();
      if (error) throw error;
      await supabase.from("counters").update({ current_ticket_id: ticketId }).eq("id", selectedCounterId);
      setCurrentTicket(updatedTicket);
      toast.success(`Senha ${updatedTicket.display_number} chamada!`);
      refresh();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleComplete = async () => {
    if (!currentTicket || !selectedCounterId) return;
    try { await completeTicket(currentTicket.id, selectedCounterId); setCurrentTicket(null); toast.success("Atendimento finalizado"); refresh(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleNoShow = async () => {
    if (!currentTicket || !selectedCounterId) return;
    try { await markNoShow(currentTicket.id, selectedCounterId); setCurrentTicket(null); toast.info("Paciente não compareceu"); refresh(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleReprint = async () => {
    if (!currentTicket) return;
    try { await printTicket(currentTicket); toast.success("Reimpressão enviada"); }
    catch { toast.error("Erro ao reimprimir"); }
  };

  const handleRecall = async () => {
    if (!currentTicket || !selectedCounterId) return;
    try {
      await supabase.from("tickets").update({ called_at: new Date().toISOString() }).eq("id", currentTicket.id);
      toast.success(`Senha ${currentTicket.display_number} rechamada!`);
      refresh();
    } catch { toast.error("Erro ao rechamar"); }
  };

  const statusColors: Record<string, string> = {
    waiting: "bg-yellow-500 text-white",
    called: "bg-primary text-primary-foreground",
    in_service: "bg-accent text-accent-foreground",
    completed: "bg-green-600 text-white",
    no_show: "bg-destructive text-destructive-foreground",
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isOperator) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">Sem permissão</p></div>;

  // Custom styles from config
  const pageBgStyle = screenConfig.counterBgColor ? { backgroundColor: screenConfig.counterBgColor } : {};
  const pageTextStyle = screenConfig.counterTextColor ? { color: screenConfig.counterTextColor } : {};
  const headerBgStyle = screenConfig.counterHeaderBgColor ? { backgroundColor: screenConfig.counterHeaderBgColor } : {};
  const headerTextStyle = screenConfig.counterHeaderTextColor ? { color: screenConfig.counterHeaderTextColor } : {};
  const fontStyle = screenConfig.counterFontFamily ? { fontFamily: screenConfig.counterFontFamily } : {};
  const btnStyle: React.CSSProperties = {
    ...(screenConfig.counterButtonBgColor ? { backgroundColor: screenConfig.counterButtonBgColor } : {}),
    ...(screenConfig.counterButtonTextColor ? { color: screenConfig.counterButtonTextColor } : {}),
  };

  return (
    <div className="min-h-screen bg-background" style={{ ...pageBgStyle, ...fontStyle }}>
      <header className="bg-card border-b border-border p-4" style={headerBgStyle}>
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {screenConfig.counterShowLogo && screenConfig.logoUrl && (
              <img src={screenConfig.logoUrl} alt="Logo" className="h-8 object-contain" />
            )}
            <h1 className="text-xl font-bold text-card-foreground" style={{ ...headerTextStyle, ...fontStyle }}>{screenConfig.counterTitle || "Painel do Guichê"}</h1>
          </div>
          <div className="flex gap-2 items-center">
            <Link to="/"><Button variant="outline" size="sm">Início</Button></Link>
            <Link to="/panel"><Button variant="outline" size="sm">Painel</Button></Link>
            <Link to="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
            <Button variant="ghost" size="sm" onClick={async () => { if (selectedCounterId) await releaseCounter(selectedCounterId); signOut(); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6" style={pageTextStyle}>
        <Card>
          <CardContent className="p-6">
            <Label className="text-sm font-medium mb-2 block">Selecione o Guichê</Label>
            <Select value={selectedCounterId} onValueChange={setSelectedCounterId}>
              <SelectTrigger className="w-full max-w-xs"><SelectValue placeholder="Escolha um guichê" /></SelectTrigger>
              <SelectContent>
                {counters.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle>Senha Atual</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {currentTicket ? (
                <>
                  <div className="text-center">
                    <p className="text-6xl font-black text-primary mb-2">{currentTicket.display_number}</p>
                    <Badge className={statusColors[currentTicket.status] || ""}>
                      {currentTicket.status === "in_service" && "Em Atendimento"}
                      {currentTicket.status === "called" && "Chamado"}
                      {currentTicket.status === "waiting" && "Aguardando"}
                    </Badge>
                    {currentTicket.patient_name && <p className="mt-2 text-muted-foreground">{currentTicket.patient_name}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={handleComplete} style={btnStyle}><CheckCircle className="h-4 w-4 mr-2" /> Finalizar</Button>
                    <Button onClick={handleNoShow} variant="destructive"><XCircle className="h-4 w-4 mr-2" /> Não Compareceu</Button>
                    <Button onClick={handleRecall} variant="secondary" className="col-span-2"><Volume2 className="h-4 w-4 mr-2" /> Rechamar</Button>
                    <Button onClick={handleReprint} variant="outline" className="col-span-2"><Printer className="h-4 w-4 mr-2" /> Reimprimir</Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8"><p className="text-muted-foreground mb-4">Nenhuma senha em atendimento</p></div>
              )}
              <Button onClick={handleCallNext} disabled={loading || !selectedCounterId} size="lg" className="w-full" style={btnStyle}>
                <SkipForward className="h-5 w-5 mr-2" />{loading ? "Chamando..." : "Chamar Próxima"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fila de Espera ({waitingTickets.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {waitingTickets.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{t.display_number}</span>
                      <span className="text-sm text-muted-foreground">{t.service_types?.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
                {waitingTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Fila vazia</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Chamadas Recentes ({calledTickets.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {calledTickets.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{t.display_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {t.status === "in_service" ? "Atendendo" : "Chamado"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.counters?.name || "—"}</span>
                  </div>
                ))}
                {calledTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma chamada</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CounterPage;
