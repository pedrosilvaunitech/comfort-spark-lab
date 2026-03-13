import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, PhoneCall, Clock, CheckCircle, Activity } from "lucide-react";
import { toast } from "sonner";

export function QueueManagement() {
  const [waitingTickets, setWaitingTickets] = useState<any[]>([]);
  const [calledTickets, setCalledTickets] = useState<any[]>([]);
  const [inServiceTickets, setInServiceTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Custom voice call
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [customVoiceText, setCustomVoiceText] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [waitingRes, calledRes, inServiceRes] = await Promise.allSettled([
      supabase.from("tickets").select("*, service_types(*)").eq("status", "waiting").order("created_at"),
      supabase.from("tickets").select("*, service_types(*), counters!tickets_counter_id_fkey(*)").in("status", ["called"]).gte("created_at", `${today}T00:00:00`).order("called_at", { ascending: false }),
      supabase.from("tickets").select("*, service_types(*), counters!tickets_counter_id_fkey(*)").eq("status", "in_service").gte("created_at", `${today}T00:00:00`).order("called_at", { ascending: false }),
    ]);

    setWaitingTickets(waitingRes.status === "fulfilled" ? waitingRes.value.data || [] : []);
    setCalledTickets(calledRes.status === "fulfilled" ? calledRes.value.data || [] : []);
    setInServiceTickets(inServiceRes.status === "fulfilled" ? inServiceRes.value.data || [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQueue();

    const channel = supabase
      .channel("admin-queue-" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        console.log("[QueueManagement] ticket change detected, refreshing...");
        loadQueue();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "counters" }, () => {
        console.log("[QueueManagement] counter change detected, refreshing...");
        loadQueue();
      })
      .subscribe((status) => {
        console.log("[QueueManagement] realtime status:", status);
      });

    // Also poll every 10 seconds as fallback
    const interval = setInterval(loadQueue, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadQueue]);

  const openCallDialog = (ticket: any) => {
    setSelectedTicket(ticket);
    const defaultText = `Senha ${ticket.display_number}, por favor dirija-se ao local indicado`;
    setCustomVoiceText(defaultText);
    setCallDialogOpen(true);
  };

  const handleCallWithVoice = async () => {
    if (!selectedTicket) return;
    try {
      // Update ticket to called status with custom voice text
      const { error } = await supabase.from("tickets")
        .update({
          status: "called" as any,
          called_at: new Date().toISOString(),
          custom_voice_text: customVoiceText || null,
        } as any)
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Voice will be triggered automatically on the Panel screen via realtime

      toast.success(`Senha ${selectedTicket.display_number} chamada!`);
      setCallDialogOpen(false);
      loadQueue();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      waiting: { label: "Aguardando", variant: "outline" },
      called: { label: "Chamado", variant: "secondary" },
      in_service: { label: "Em Atendimento", variant: "default" },
    };
    const info = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-foreground">Gestão da Fila</h2>
        <Button onClick={loadQueue} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" /> Aguardando ({waitingTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {waitingTickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <span className="font-bold text-foreground">{t.display_number}</span>
                    <span className="text-xs text-muted-foreground ml-2">{t.service_types?.name}</span>
                    {t.patient_name && <p className="text-xs text-muted-foreground">{t.patient_name}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCallDialog(t)} title="Chamar com voz personalizada">
                    <PhoneCall className="h-3.5 w-3.5 mr-1" /> Chamar
                  </Button>
                </div>
              ))}
              {waitingTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Fila vazia</p>}
            </div>
          </CardContent>
        </Card>

        {/* Called */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-blue-500" /> Chamadas ({calledTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {calledTickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <span className="font-bold text-foreground">{t.display_number}</span>
                    {statusBadge(t.status)}
                    <p className="text-xs text-muted-foreground mt-1">{t.counters?.name || "—"}</p>
                    {t.called_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.called_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {calledTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma chamada</p>}
            </div>
          </CardContent>
        </Card>

        {/* In Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" /> Em Atendimento ({inServiceTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {inServiceTickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <span className="font-bold text-foreground">{t.display_number}</span>
                    <Badge variant="default">Atendendo</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{t.counters?.name || "—"}</p>
                    {t.patient_name && <p className="text-xs text-muted-foreground">{t.patient_name}</p>}
                  </div>
                </div>
              ))}
              {inServiceTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum atendimento</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call with custom voice dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chamar Senha {selectedTicket?.display_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Texto que será falado pela voz</Label>
              <Textarea
                value={customVoiceText}
                onChange={(e) => setCustomVoiceText(e.target.value)}
                placeholder="Ex: Senha N0001, dirija-se ao laboratório para coleta de exames"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Personalize o texto para direcionar o paciente ao local correto
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCallWithVoice} className="flex-1">
                <PhoneCall className="h-4 w-4 mr-2" /> Chamar Agora
              </Button>
              <Button variant="outline" onClick={() => setCallDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
