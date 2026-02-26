import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getCounters,
  callNextTicket,
  startService,
  completeTicket,
  markNoShow,
  getWaitingTickets,
} from "@/lib/ticket-service";
import { printTicket } from "@/lib/print-service";
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets";
import { Phone, CheckCircle, XCircle, Printer, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const CounterPage = () => {
  const [selectedCounterId, setSelectedCounterId] = useState<string>("");
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { counters, waitingTickets, refresh } = useRealtimeTickets();

  const selectedCounter = counters.find((c: any) => c.id === selectedCounterId);

  // Load current ticket for selected counter
  useEffect(() => {
    if (selectedCounter?.tickets) {
      setCurrentTicket(selectedCounter.tickets);
    } else {
      setCurrentTicket(null);
    }
  }, [selectedCounter]);

  const handleCallNext = async () => {
    if (!selectedCounterId) {
      toast.error("Selecione um guichê");
      return;
    }
    setLoading(true);
    try {
      const ticket = await callNextTicket(selectedCounterId);
      if (ticket) {
        setCurrentTicket(ticket);
        toast.success(`Senha ${ticket.display_number} chamada!`);
      } else {
        toast.info("Nenhuma senha na fila");
        setCurrentTicket(null);
      }
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartService = async () => {
    if (!currentTicket) return;
    try {
      await startService(currentTicket.id);
      setCurrentTicket({ ...currentTicket, status: "in_service" });
      toast.success("Atendimento iniciado");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleComplete = async () => {
    if (!currentTicket || !selectedCounterId) return;
    try {
      await completeTicket(currentTicket.id, selectedCounterId);
      setCurrentTicket(null);
      toast.success("Atendimento finalizado");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleNoShow = async () => {
    if (!currentTicket || !selectedCounterId) return;
    try {
      await markNoShow(currentTicket.id, selectedCounterId);
      setCurrentTicket(null);
      toast.info("Paciente não compareceu");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReprint = async () => {
    if (!currentTicket) return;
    try {
      await printTicket(currentTicket);
      toast.success("Reimpressão enviada");
    } catch {
      toast.error("Erro ao reimprimir");
    }
  };

  const statusColors: Record<string, string> = {
    waiting: "bg-warning text-warning-foreground",
    called: "bg-primary text-primary-foreground",
    in_service: "bg-accent text-accent-foreground",
    completed: "bg-success text-success-foreground",
    no_show: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-card-foreground">Painel do Guichê</h1>
          <div className="flex gap-2">
            <Link to="/panel">
              <Button variant="outline" size="sm">Ver Painel</Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline" size="sm">Admin</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* Counter Selection */}
        <Card>
          <CardContent className="p-6">
            <Label className="text-sm font-medium mb-2 block">Selecione o Guichê</Label>
            <Select value={selectedCounterId} onValueChange={setSelectedCounterId}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Escolha um guichê" />
              </SelectTrigger>
              <SelectContent>
                {counters.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Ticket */}
          <Card>
            <CardHeader>
              <CardTitle>Senha Atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentTicket ? (
                <>
                  <div className="text-center">
                    <p className="text-6xl font-black text-primary mb-2">
                      {currentTicket.display_number}
                    </p>
                    <Badge className={statusColors[currentTicket.status] || ""}>
                      {currentTicket.status === "called" && "Chamado"}
                      {currentTicket.status === "in_service" && "Em Atendimento"}
                      {currentTicket.status === "waiting" && "Aguardando"}
                    </Badge>
                    {currentTicket.patient_name && (
                      <p className="mt-2 text-muted-foreground">{currentTicket.patient_name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {currentTicket.status === "called" && (
                      <Button onClick={handleStartService} className="bg-accent hover:bg-accent/90">
                        <CheckCircle className="h-4 w-4 mr-2" /> Iniciar
                      </Button>
                    )}
                    {(currentTicket.status === "called" || currentTicket.status === "in_service") && (
                      <>
                        <Button onClick={handleComplete} variant="default">
                          <CheckCircle className="h-4 w-4 mr-2" /> Finalizar
                        </Button>
                        <Button onClick={handleNoShow} variant="destructive">
                          <XCircle className="h-4 w-4 mr-2" /> Não Compareceu
                        </Button>
                      </>
                    )}
                    <Button onClick={handleReprint} variant="outline">
                      <Printer className="h-4 w-4 mr-2" /> Reimprimir
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Nenhuma senha em atendimento</p>
                </div>
              )}

              <Button
                onClick={handleCallNext}
                disabled={loading || !selectedCounterId}
                size="lg"
                className="w-full"
              >
                <SkipForward className="h-5 w-5 mr-2" />
                {loading ? "Chamando..." : "Chamar Próxima"}
              </Button>
            </CardContent>
          </Card>

          {/* Queue */}
          <Card>
            <CardHeader>
              <CardTitle>Fila de Espera ({waitingTickets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {waitingTickets.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{t.display_number}</span>
                      <span className="text-sm text-muted-foreground">
                        {t.service_types?.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
                {waitingTickets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Fila vazia
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// Need Label import
import { Label } from "@/components/ui/label";

export default CounterPage;
